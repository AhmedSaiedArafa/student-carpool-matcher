const { query, transaction } = require('../../db');

async function createTemplate(data) {
  const { rows } = await query(
    `INSERT INTO ride_templates (driver_id, origin_lat, origin_lng, origin_name, destination_lat, destination_lng, destination_name, weekday, departure_time, seats_total, fare, pickup_area_radius_km, stops)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [data.driver_id, data.origin_lat, data.origin_lng, data.origin_name || null,
     data.destination_lat, data.destination_lng, data.destination_name || null,
     data.weekday, data.departure_time, data.seats_total, data.fare || null,
     data.pickup_area_radius_km || 2.0, JSON.stringify(data.stops || [])]
  );
  return rows[0];
}

async function findTemplateById(id) {
  const { rows } = await query('SELECT * FROM ride_templates WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findTemplatesByDriver(driverId) {
  const { rows } = await query(
    'SELECT * FROM ride_templates WHERE driver_id = $1 ORDER BY weekday, departure_time',
    [driverId]
  );
  return rows;
}

async function updateTemplate(id, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    vals.push(key === 'stops' ? JSON.stringify(val) : val);
    i++;
  }
  vals.push(id);
  const { rows } = await query(
    `UPDATE ride_templates SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] || null;
}

async function createTripInstance(data) {
  const { rows } = await query(
    `INSERT INTO trip_instances (ride_template_id, trip_date, departure_at, seats_remaining)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.ride_template_id, data.trip_date, data.departure_at, data.seats_remaining]
  );
  return rows[0];
}

async function findTripById(id) {
  const { rows } = await query(
    `SELECT ti.*, rt.driver_id, rt.origin_lat, rt.origin_lng, rt.origin_name,
            rt.destination_lat, rt.destination_lng, rt.destination_name,
            rt.weekday, rt.departure_time, rt.seats_total, rt.fare,
            rt.pickup_area_radius_km, rt.stops, u.name as driver_name
     FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     JOIN users u ON rt.driver_id = u.id
     WHERE ti.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findTripsByTemplate(templateId) {
  const { rows } = await query(
    `SELECT * FROM trip_instances WHERE ride_template_id = $1 ORDER BY trip_date`,
    [templateId]
  );
  return rows;
}

async function updateTripStatus(id, status) {
  const { rows } = await query(
    'UPDATE trip_instances SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

async function findRequestsByTrip(tripId) {
  const { rows } = await query(
    `SELECT jr.*, u.name as rider_name, u.university_email
     FROM join_requests jr JOIN users u ON jr.rider_id = u.id
     WHERE jr.trip_id = $1 ORDER BY jr.requested_at`,
    [tripId]
  );
  return rows;
}

async function findApprovedPassengers(tripId) {
  const { rows } = await query(
    `SELECT jr.*, u.name as rider_name, u.university_email
     FROM join_requests jr JOIN users u ON jr.rider_id = u.id
     WHERE jr.trip_id = $1 AND jr.status = 'approved'`,
    [tripId]
  );
  return rows;
}

async function findRequestById(id) {
  const { rows } = await query(
    `SELECT jr.*, ti.ride_template_id, rt.driver_id, rt.origin_name, rt.destination_name
     FROM join_requests jr
     JOIN trip_instances ti ON jr.trip_id = ti.id
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE jr.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function decideRequest(requestId, status, client) {
  const q = client ? client.query.bind(client) : query;
  const { rows } = await q(
    `UPDATE join_requests SET status = $1, decided_at = NOW() WHERE id = $2 RETURNING *`,
    [status, requestId]
  );
  return rows[0] || null;
}

async function decrementSeats(tripId, client) {
  const q = client ? client.query.bind(client) : query;
  const { rows } = await q(
    `UPDATE trip_instances SET seats_remaining = seats_remaining - 1
     WHERE id = $1 AND seats_remaining > 0 RETURNING *`,
    [tripId]
  );
  return rows[0] || null;
}

async function incrementSeats(tripId, client) {
  const q = client ? client.query.bind(client) : query;
  const { rows } = await q(
    `UPDATE trip_instances SET seats_remaining = seats_remaining + 1
     WHERE id = $1 AND seats_remaining < (SELECT seats_total FROM ride_templates WHERE id = trip_instances.ride_template_id)
     RETURNING *`,
    [tripId]
  );
  return rows[0] || null;
}

async function getDriverDashboard(driverId) {
  const { rows: upcoming } = await query(
    `SELECT ti.*, rt.origin_name, rt.destination_name, rt.seats_total, rt.departure_time
     FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE rt.driver_id = $1 AND ti.status = 'scheduled' AND ti.trip_date >= CURRENT_DATE
     ORDER BY ti.trip_date`,
    [driverId]
  );
  const { rows: pending } = await query(
    `SELECT jr.*, ti.trip_date, u.name as rider_name, rt.origin_name, rt.destination_name
     FROM join_requests jr
     JOIN trip_instances ti ON jr.trip_id = ti.id
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     JOIN users u ON jr.rider_id = u.id
     WHERE rt.driver_id = $1 AND jr.status = 'pending'
     ORDER BY jr.requested_at`,
    [driverId]
  );
  return { upcoming, pending };
}

async function cancelTripRequests(tripId, client) {
  const q = client ? client.query.bind(client) : query;
  const { rows } = await q(
    `UPDATE join_requests SET status = 'cancelled', decided_at = NOW()
     WHERE trip_id = $1 AND status IN ('pending', 'approved') RETURNING rider_id`,
    [tripId]
  );
  return rows;
}

module.exports = {
  createTemplate, findTemplateById, findTemplatesByDriver, updateTemplate,
  createTripInstance, findTripById, findTripsByTemplate, updateTripStatus,
  findRequestsByTrip, findApprovedPassengers, findRequestById,
  decideRequest, decrementSeats, incrementSeats,
  getDriverDashboard, cancelTripRequests,
};
