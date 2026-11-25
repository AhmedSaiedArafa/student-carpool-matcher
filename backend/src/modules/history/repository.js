const { query } = require('../../db');

async function getHistory(userId, role) {
  if (role === 'driver') {
    const { rows } = await query(
      `SELECT ti.*, rt.origin_name, rt.destination_name, rt.seats_total, rt.fare,
              (SELECT COUNT(*) FROM join_requests jr WHERE jr.trip_id = ti.id AND jr.status = 'approved') as passenger_count
       FROM trip_instances ti
       JOIN ride_templates rt ON ti.ride_template_id = rt.id
       WHERE rt.driver_id = $1
       ORDER BY ti.trip_date DESC`,
      [userId]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT ti.*, rt.origin_name, rt.destination_name, rt.fare,
            jr.status as request_status, u.name as driver_name
     FROM join_requests jr
     JOIN trip_instances ti ON jr.trip_id = ti.id
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     JOIN users u ON rt.driver_id = u.id
     WHERE jr.rider_id = $1
     ORDER BY ti.trip_date DESC`,
    [userId]
  );
  return rows;
}

async function completeTrip(tripId) {
  const { rows } = await query(
    `UPDATE trip_instances SET status = 'completed' WHERE id = $1 AND status = 'scheduled' RETURNING *`,
    [tripId]
  );
  return rows[0] || null;
}

async function getReliability(userId) {
  const { rows: ratingStats } = await query(
    `SELECT
       COALESCE(AVG(score), 0) as average_score,
       COUNT(*) as rating_count
     FROM ratings WHERE subject_id = $1`,
    [userId]
  );

  const { rows: tripStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
     FROM (
       SELECT ti.status FROM trip_instances ti
       JOIN ride_templates rt ON ti.ride_template_id = rt.id
       WHERE rt.driver_id = $1 AND ti.status IN ('completed','cancelled')
       UNION ALL
       SELECT ti.status FROM trip_instances ti
       JOIN join_requests jr ON jr.trip_id = ti.id
       WHERE jr.rider_id = $1 AND jr.status IN ('approved','cancelled')
         AND ti.status IN ('completed','cancelled')
     ) combined`,
    [userId]
  );

  const { rows: driverTrips } = await query(
    `SELECT COUNT(*) as count FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE rt.driver_id = $1 AND ti.status = 'completed'`,
    [userId]
  );

  const { rows: riderTrips } = await query(
    `SELECT COUNT(*) as count FROM trip_instances ti
     JOIN join_requests jr ON jr.trip_id = ti.id
     WHERE jr.rider_id = $1 AND jr.status = 'approved' AND ti.status = 'completed'`,
    [userId]
  );

  const { rows: attendanceStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE showed_up = true) as showed_up,
       COUNT(*) as total
     FROM attendance WHERE user_id = $1`,
    [userId]
  );

  const completed = parseInt(tripStats[0].completed);
  const cancelled = parseInt(tripStats[0].cancelled);
  const total = completed + cancelled;
  const attendance = attendanceStats[0] || { showed_up: 0, total: 0 };

  return {
    average_score: parseFloat(ratingStats[0].average_score) || 0,
    rating_count: parseInt(ratingStats[0].rating_count),
    completion_rate: total > 0 ? completed / total : 1,
    cancellation_rate: total > 0 ? cancelled / total : 0,
    punctuality_rate: attendance.total > 0 ? parseInt(attendance.showed_up) / parseInt(attendance.total) : 1,
    completed_trips_as_driver: parseInt(driverTrips[0].count),
    completed_trips_as_rider: parseInt(riderTrips[0].count),
  };
}

async function getBadges(userId) {
  const { BADGE_TRUSTED_MIN_TRIPS } = require('../../config/env');
  const reliability = await getReliability(userId);
  const avg = reliability.average_score;
  const count = reliability.rating_count;
  const driverTrips = reliability.completed_trips_as_driver;
  const riderTrips = reliability.completed_trips_as_rider;

  const { rows: perfectRows } = await query(
    `SELECT COUNT(*) FILTER (WHERE score < 5) as imperfect, COUNT(*) as total
     FROM ratings WHERE subject_id = $1`,
    [userId]
  );
  const allPerfect = parseInt(perfectRows[0].total) >= 3 && parseInt(perfectRows[0].imperfect) === 0;

  const badges = [
    {
      name: 'Rising Star', level: 'bronze',
      description: 'Average rating at least 3.5 with at least 1 rating',
      earned: avg >= 3.5 && count >= 1,
      progress: { rating: { current: avg, target: 3.5 }, ratings: { current: count, target: 1 } },
    },
    {
      name: 'Well Rated', level: 'silver',
      description: 'Average rating at least 4.0 with at least 3 ratings',
      earned: avg >= 4.0 && count >= 3,
      progress: { rating: { current: avg, target: 4.0 }, ratings: { current: count, target: 3 } },
    },
    {
      name: 'Top Rated', level: 'gold',
      description: 'Average rating at least 4.5 with at least 5 ratings',
      earned: avg >= 4.5 && count >= 5,
      progress: { rating: { current: avg, target: 4.5 }, ratings: { current: count, target: 5 } },
    },
    {
      name: 'Trusted Driver', level: 'driver',
      description: `Average rating at least 4.0, at least ${BADGE_TRUSTED_MIN_TRIPS} completed trips as driver, and completion rate at least 90%`,
      earned: avg >= 4.0 && driverTrips >= BADGE_TRUSTED_MIN_TRIPS && reliability.completion_rate >= 0.9,
      progress: { rating: { current: avg, target: 4.0 }, trips: { current: driverTrips, target: BADGE_TRUSTED_MIN_TRIPS } },
    },
    {
      name: 'Reliable Rider', level: 'rider',
      description: 'Average rating at least 4.0, at least 3 completed trips as rider, and cancellation rate at most 10%',
      earned: avg >= 4.0 && riderTrips >= 3 && reliability.cancellation_rate <= 0.1,
      progress: { rating: { current: avg, target: 4.0 }, trips: { current: riderTrips, target: 3 } },
    },
    {
      name: 'Perfect 5', level: 'special',
      description: 'At least 3 ratings and every one of them is 5 stars',
      earned: allPerfect,
      progress: { ratings: { current: parseInt(perfectRows[0].total), target: 3 } },
    },
  ];

  return badges;
}

async function createRating(tripId, authorId, subjectId, direction, score, comment) {
  const { rows } = await query(
    `INSERT INTO ratings (trip_id, author_id, subject_id, direction, score, comment)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tripId, authorId, subjectId, direction, score, comment || null]
  );
  return rows[0];
}

async function findPendingRatings(tripId, userId) {
  const participant = await findTripParticipant(tripId, userId);
  if (!participant) return [];

  if (participant.role === 'driver') {
    const { rows } = await query(
      `SELECT u.id, u.name, 'rider' as role
       FROM join_requests jr JOIN users u ON jr.rider_id = u.id
       WHERE jr.trip_id = $1 AND jr.status = 'approved'
         AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.trip_id = $1 AND r.author_id = $2 AND r.subject_id = u.id)`,
      [tripId, userId]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT u.id, u.name, 'driver' as role
     FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     JOIN users u ON rt.driver_id = u.id
     WHERE ti.id = $1
       AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.trip_id = $1 AND r.author_id = $2 AND r.subject_id = u.id)`,
    [tripId, userId]
  );
  return rows;
}

async function getUserRatings(userId) {
  const { rows } = await query(
    `SELECT r.score, r.comment, r.created_at, u.name as author_name,
            rt.origin_name, rt.destination_name, ti.trip_date
     FROM ratings r
     JOIN users u ON r.author_id = u.id
     JOIN trip_instances ti ON r.trip_id = ti.id
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE r.subject_id = $1
     ORDER BY r.created_at DESC LIMIT 20`,
    [userId]
  );
  return rows;
}

async function findApprovedRiders(tripId) {
  const { rows } = await query(
    `SELECT u.id, u.name FROM join_requests jr
     JOIN users u ON jr.rider_id = u.id
     WHERE jr.trip_id = $1 AND jr.status = 'approved'`,
    [tripId]
  );
  return rows;
}

async function recordAttendance(tripId, userId, showedUp) {
  const { rows } = await query(
    `INSERT INTO attendance (trip_id, user_id, showed_up) VALUES ($1, $2, $3)
     ON CONFLICT (trip_id, user_id) DO UPDATE SET showed_up = $3 RETURNING *`,
    [tripId, userId, showedUp]
  );
  return rows[0];
}

async function findTripParticipant(tripId, userId) {
  const { rows: asDriver } = await query(
    `SELECT rt.driver_id FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE ti.id = $1 AND rt.driver_id = $2`,
    [tripId, userId]
  );
  if (asDriver.length > 0) return { role: 'driver', userId };

  const { rows: asRider } = await query(
    `SELECT rider_id FROM join_requests
     WHERE trip_id = $1 AND rider_id = $2 AND status = 'approved'`,
    [tripId, userId]
  );
  if (asRider.length > 0) return { role: 'rider', userId };

  return null;
}

module.exports = {
  getHistory, completeTrip,
  getReliability, getBadges, recordAttendance, findTripParticipant,
  createRating, findPendingRatings, getUserRatings, findApprovedRiders,
};
