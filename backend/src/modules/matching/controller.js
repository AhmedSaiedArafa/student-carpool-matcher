const service = require('./service');
const { geocode, reverseGeocode } = require('../../utils/geo');
const AppError = require('../../utils/AppError');

async function findMatches(req, res) {
  const matches = await service.findMatches({
    pickupLat: parseFloat(req.query.pickupLat),
    pickupLng: parseFloat(req.query.pickupLng),
    dropoffLat: req.query.dropoffLat ? parseFloat(req.query.dropoffLat) : undefined,
    dropoffLng: req.query.dropoffLng ? parseFloat(req.query.dropoffLng) : undefined,
    departureAfter: req.query.departureAfter,
    departureBefore: req.query.departureBefore,
    weekday: req.query.weekday !== undefined ? parseInt(req.query.weekday) : undefined,
  });
  res.json({ data: matches });
}

async function requestSeat(req, res) {
  const result = await service.requestSeat(
    parseInt(req.params.id), req.user.id,
    req.body.pickup_lat, req.body.pickup_lng, req.body.offered_fare
  );
  res.status(201).json({ data: result });
}

async function withdrawRequest(req, res) {
  await service.withdrawRequest(parseInt(req.params.id), req.user.id);
  res.status(204).end();
}

async function getMyRequests(req, res) {
  const requests = await service.getMyRequests(req.user.id);
  res.json({ data: requests });
}

async function joinWaitlist(req, res) {
  const result = await service.joinWaitlist(parseInt(req.params.id), req.user.id);
  res.status(201).json({ data: result });
}

async function leaveWaitlist(req, res) {
  await service.leaveWaitlist(parseInt(req.params.id), req.user.id);
  res.status(204).end();
}

async function acceptWaitlistOffer(req, res) {
  const result = await service.acceptWaitlistOffer(parseInt(req.params.id), req.user.id);
  res.json({ data: result });
}

async function getNotifications(req, res) {
  const unreadOnly = req.query.unread === 'true';
  const notifications = await service.getNotifications(req.user.id, unreadOnly);
  res.json({ data: notifications });
}

async function markNotificationRead(req, res) {
  await service.markNotificationRead(parseInt(req.params.id), req.user.id);
  res.json({ data: { success: true } });
}

async function markAllNotificationsRead(req, res) {
  await service.markAllNotificationsRead(req.user.id);
  res.json({ data: { success: true } });
}

async function geocodeSearch(req, res) {
  const results = await geocode(req.query.q, 6);
  if (!results) throw new AppError(502, 'EXTERNAL_API_ERROR', 'Geocoding service unavailable');
  res.json({ data: results });
}

async function geocodeReverse(req, res) {
  const name = await reverseGeocode(parseFloat(req.query.lat), parseFloat(req.query.lng));
  if (!name) throw new AppError(502, 'EXTERNAL_API_ERROR', 'Reverse geocoding service unavailable');
  res.json({ data: { name } });
}

module.exports = {
  findMatches, requestSeat, withdrawRequest, getMyRequests,
  joinWaitlist, leaveWaitlist, acceptWaitlistOffer,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  geocodeSearch, geocodeReverse,
};
