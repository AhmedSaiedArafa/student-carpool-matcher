const { query, transaction } = require('../../db');

async function findAvailableTrips(filters) {
  const conditions = [`ti.status = 'scheduled'`, `ti.trip_date >= CURRENT_DATE`, `ti.seats_remaining > 0`, `rt.status = 'active'`];
  const params = [];
  let i = 1;

  if (filters.departureAfter) {
    conditions.push(`ti.departure_at >= $${i}`);
    params.push(filters.departureAfter);
    i++;
  }
  if (filters.departureBefore) {
    conditions.push(`ti.departure_at <= $${i}`);
    params.push(filters.departureBefore);
    i++;
  }
  if (filters.weekday !== undefined) {
    conditions.push(`EXTRACT(DOW FROM ti.trip_date)::int = $${i}`);
    params.push(filters.weekday);
    i++;
  }

  const { rows } = await query(
    `SELECT ti.*, rt.driver_id, rt.origin_lat, rt.origin_lng, rt.origin_name,
            rt.destination_lat, rt.destination_lng, rt.destination_name,
            rt.weekday, rt.departure_time, rt.seats_total, rt.fare,
            rt.pickup_area_radius_km, rt.stops, rt.schedule_type, rt.weekdays,
            u.name as driver_name
     FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     JOIN users u ON rt.driver_id = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ti.departure_at`,
    params
  );
  return rows;
}

async function createRequest(tripId, riderId, pickupLat, pickupLng, offeredFare) {
  const { rows } = await query(
    `INSERT INTO join_requests (trip_id, rider_id, pickup_lat, pickup_lng, offered_fare) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tripId, riderId, pickupLat || null, pickupLng || null, offeredFare != null ? offeredFare : null]
  );
  return rows[0];
}

async function reactivateRequest(tripId, riderId, pickupLat, pickupLng, offeredFare) {
  const { rows } = await query(
    `UPDATE join_requests
     SET status = 'pending', offered_fare = $3, pickup_lat = $4, pickup_lng = $5,
         requested_at = NOW(), decided_at = NULL
     WHERE trip_id = $1 AND rider_id = $2 AND status IN ('withdrawn', 'rejected', 'cancelled')
     RETURNING *`,
    [tripId, riderId, offeredFare != null ? offeredFare : null, pickupLat || null, pickupLng || null]
  );
  return rows[0] || null;
}

async function findRequestByTripAndRider(tripId, riderId) {
  const { rows } = await query(
    'SELECT * FROM join_requests WHERE trip_id = $1 AND rider_id = $2',
    [tripId, riderId]
  );
  return rows[0] || null;
}

async function findRequestById(id) {
  const { rows } = await query('SELECT * FROM join_requests WHERE id = $1', [id]);
  return rows[0] || null;
}

async function withdrawRequest(id) {
  const { rows } = await query(
    `UPDATE join_requests SET status = 'withdrawn', decided_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function cancelApprovedRequest(id) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE join_requests SET status = 'cancelled', decided_at = NOW() WHERE id = $1 AND status = 'approved' RETURNING *`,
      [id]
    );
    if (!rows[0]) return null;
    await client.query(
      `UPDATE trip_instances SET seats_remaining = seats_remaining + 1 WHERE id = $1`,
      [rows[0].trip_id]
    );
    return rows[0];
  });
}

async function getMyRequests(riderId) {
  const { rows } = await query(
    `SELECT jr.*, jr.offered_fare, ti.trip_date, ti.departure_at, ti.status as trip_status,
            rt.origin_name, rt.destination_name, rt.fare, u.name as driver_name
     FROM join_requests jr
     JOIN trip_instances ti ON jr.trip_id = ti.id
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     JOIN users u ON rt.driver_id = u.id
     WHERE jr.rider_id = $1
     ORDER BY ti.departure_at DESC`,
    [riderId]
  );
  return rows;
}

async function joinWaitlist(tripId, riderId) {
  const { rows: posRows } = await query(
    'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM waitlist WHERE trip_id = $1',
    [tripId]
  );
  const { rows } = await query(
    `INSERT INTO waitlist (trip_id, rider_id, position) VALUES ($1, $2, $3) RETURNING *`,
    [tripId, riderId, posRows[0].next_pos]
  );
  return rows[0];
}

async function findWaitlistEntry(tripId, riderId) {
  const { rows } = await query(
    'SELECT * FROM waitlist WHERE trip_id = $1 AND rider_id = $2 AND status = $3',
    [tripId, riderId, 'waiting']
  );
  return rows[0] || null;
}

async function findWaitlistById(id) {
  const { rows } = await query('SELECT * FROM waitlist WHERE id = $1', [id]);
  return rows[0] || null;
}

async function leaveWaitlist(id) {
  const { rows } = await query(
    `UPDATE waitlist SET status = 'left' WHERE id = $1 AND status IN ('waiting', 'offered') RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function offerSeatToNext(tripId) {
  const { rows } = await query(
    `UPDATE waitlist SET status = 'offered', offer_expires_at = NOW() + INTERVAL '30 minutes'
     WHERE id = (SELECT id FROM waitlist WHERE trip_id = $1 AND status = 'waiting' ORDER BY position LIMIT 1)
     RETURNING *`,
    [tripId]
  );
  return rows[0] || null;
}

async function acceptWaitlistOffer(waitlistId) {
  return transaction(async (client) => {
    const { rows: wl } = await client.query(
      `UPDATE waitlist SET status = 'accepted'
       WHERE id = $1 AND status = 'offered' AND offer_expires_at > NOW() RETURNING *`,
      [waitlistId]
    );
    if (!wl[0]) return null;

    const { rows: trip } = await client.query(
      `UPDATE trip_instances SET seats_remaining = seats_remaining - 1
       WHERE id = $1 AND seats_remaining > 0 RETURNING *`,
      [wl[0].trip_id]
    );
    if (!trip[0]) return null;

    await client.query(
      `INSERT INTO join_requests (trip_id, rider_id, status, decided_at)
       VALUES ($1, $2, 'approved', NOW())`,
      [wl[0].trip_id, wl[0].rider_id]
    );

    return wl[0];
  });
}

async function expireStaleRequests() {
  const { rows } = await query(
    `UPDATE join_requests SET status = 'cancelled', decided_at = NOW()
     WHERE status = 'pending' AND requested_at < NOW() - INTERVAL '48 hours' RETURNING id, rider_id, trip_id`
  );
  return rows;
}

async function expireStaleOffers() {
  const { rows } = await query(
    `UPDATE waitlist SET status = 'expired'
     WHERE status = 'offered' AND offer_expires_at < NOW() RETURNING trip_id`
  );
  return rows;
}

module.exports = {
  findAvailableTrips, createRequest, reactivateRequest, findRequestByTripAndRider, findRequestById,
  withdrawRequest, cancelApprovedRequest, getMyRequests,
  joinWaitlist, findWaitlistEntry, findWaitlistById, leaveWaitlist,
  offerSeatToNext, acceptWaitlistOffer,
  expireStaleRequests, expireStaleOffers,
};
