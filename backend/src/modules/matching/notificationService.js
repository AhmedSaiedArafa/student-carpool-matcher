const { query } = require('../../db');

async function notify(userId, type, message, tripId = null) {
  await query(
    'INSERT INTO notifications (user_id, type, message, trip_id) VALUES ($1, $2, $3, $4)',
    [userId, type, message, tripId]
  );
}

async function notifyRequestDecision(riderId, tripId, decision, tripInfo = null) {
  const route = tripInfo ? ` for ${tripInfo.origin_name} → ${tripInfo.destination_name}` : '';
  const msg = decision === 'approved'
    ? `Your ride request${route} has been approved!`
    : `Your ride request${route} has been rejected.`;
  await notify(riderId, `request_${decision}`, msg, tripId);
}

async function getNotifications(userId, unreadOnly = false) {
  const filter = unreadOnly ? 'AND is_read = false' : '';
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ${filter} ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return rows;
}

async function markRead(notificationId, userId) {
  await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

async function markAllRead(userId) {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);
}

module.exports = { notify, notifyRequestDecision, getNotifications, markRead, markAllRead };
