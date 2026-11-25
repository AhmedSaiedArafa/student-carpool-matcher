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
       COUNT(*) FILTER (WHERE ti.status = 'completed') as completed,
       COUNT(*) FILTER (WHERE ti.status = 'cancelled') as cancelled,
       COUNT(*) as total
     FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE rt.driver_id = $1`,
    [userId]
  );

  const { rows: attendanceStats } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE showed_up = true) as showed_up,
       COUNT(*) as total
     FROM attendance WHERE user_id = $1`,
    [userId]
  );

  const stats = tripStats[0] || { completed: 0, cancelled: 0, total: 0 };
  const attendance = attendanceStats[0] || { showed_up: 0, total: 0 };

  return {
    average_score: parseFloat(ratingStats[0].average_score) || 0,
    rating_count: parseInt(ratingStats[0].rating_count),
    completion_rate: stats.total > 0 ? parseInt(stats.completed) / parseInt(stats.total) : 0,
    cancellation_rate: stats.total > 0 ? parseInt(stats.cancelled) / parseInt(stats.total) : 0,
    punctuality_rate: attendance.total > 0 ? parseInt(attendance.showed_up) / parseInt(attendance.total) : 1,
  };
}

async function getBadges(userId) {
  const reliability = await getReliability(userId);
  const badges = [];

  const { rows: completedTrips } = await query(
    `SELECT COUNT(*) as count FROM trip_instances ti
     JOIN ride_templates rt ON ti.ride_template_id = rt.id
     WHERE rt.driver_id = $1 AND ti.status = 'completed'`,
    [userId]
  );

  const tripCount = parseInt(completedTrips[0].count);

  if (tripCount >= 10 && reliability.average_score >= 4.0 && reliability.completion_rate >= 0.9) {
    badges.push({ name: 'Trusted Driver', description: 'Completed 10+ trips with 4+ rating and 90%+ completion', earned_at: new Date() });
  }
  if (tripCount >= 25) {
    badges.push({ name: 'Road Veteran', description: 'Completed 25+ trips', earned_at: new Date() });
  }
  if (reliability.average_score >= 4.5 && reliability.rating_count >= 5) {
    badges.push({ name: 'Top Rated', description: 'Average rating 4.5+ with 5+ reviews', earned_at: new Date() });
  }
  if (reliability.punctuality_rate >= 0.95 && reliability.rating_count >= 5) {
    badges.push({ name: 'Always On Time', description: '95%+ punctuality rate', earned_at: new Date() });
  }

  return badges;
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
};
