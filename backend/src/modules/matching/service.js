const AppError = require('../../utils/AppError');
const { haversineKm } = require('../../utils/geo');
const repo = require('./repository');
const ridesRepo = require('../rides/repository');
const notificationService = require('./notificationService');

async function findMatches({ pickupLat, pickupLng, dropoffLat, dropoffLng, departureAfter, departureBefore, weekday }) {
  const trips = await repo.findAvailableTrips({ departureAfter, departureBefore, weekday });

  const scored = trips.map(trip => {
    const pickupDist = haversineKm(pickupLat, pickupLng, trip.origin_lat, trip.origin_lng);
    const withinPickupArea = pickupDist <= (trip.pickup_area_radius_km || 5);

    let dropoffDist = 0;
    if (dropoffLat && dropoffLng) {
      dropoffDist = haversineKm(dropoffLat, dropoffLng, trip.destination_lat, trip.destination_lng);
    }

    const timeGap = departureAfter
      ? Math.abs(new Date(trip.departure_at) - new Date(departureAfter)) / 60000
      : 0;

    const distScore = Math.max(0, 100 - pickupDist * 20);
    const dropoffScore = dropoffLat ? Math.max(0, 100 - dropoffDist * 20) : 50;
    const timeScore = Math.max(0, 100 - timeGap * 2);
    const seatScore = (trip.seats_remaining / trip.seats_total) * 100;

    const score = distScore * 0.35 + dropoffScore * 0.2 + timeScore * 0.3 + seatScore * 0.15;

    return { ...trip, pickupDist: Math.round(pickupDist * 100) / 100, dropoffDist: Math.round(dropoffDist * 100) / 100, score: Math.round(score), withinPickupArea };
  });

  return scored
    .filter(t => t.withinPickupArea)
    .sort((a, b) => b.score - a.score);
}

async function requestSeat(tripId, riderId, pickupLat, pickupLng) {
  const trip = await ridesRepo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.status !== 'scheduled') throw new AppError(409, 'NOT_AVAILABLE', 'Trip is not available');
  if (trip.driver_id === riderId) throw new AppError(400, 'OWN_TRIP', 'Cannot request your own trip');

  const existing = await repo.findRequestByTripAndRider(tripId, riderId);
  if (existing && ['pending', 'approved'].includes(existing.status)) {
    throw new AppError(409, 'ALREADY_REQUESTED', 'You already have a request for this trip');
  }

  if (trip.seats_remaining <= 0) {
    throw new AppError(409, 'NO_SEATS', 'No seats available. Try the waitlist.');
  }

  const request = await repo.createRequest(tripId, riderId, pickupLat, pickupLng);
  await notificationService.notify(trip.driver_id, 'new_request', 'New seat request for your ride', tripId);
  return request;
}

async function withdrawRequest(requestId, riderId) {
  const request = await repo.findRequestById(requestId);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
  if (request.rider_id !== riderId) throw new AppError(403, 'FORBIDDEN', 'Not your request');

  if (request.status === 'pending') {
    const result = await repo.withdrawRequest(requestId);
    if (!result) throw new AppError(409, 'CANNOT_WITHDRAW', 'Request cannot be withdrawn');
    return result;
  }

  if (request.status === 'approved') {
    const result = await repo.cancelApprovedRequest(requestId);
    if (!result) throw new AppError(409, 'CANNOT_CANCEL', 'Request cannot be cancelled');

    const offered = await repo.offerSeatToNext(request.trip_id);
    if (offered) {
      await notificationService.notify(offered.rider_id, 'seat_offered', 'A seat has freed up! Accept within 30 minutes.', request.trip_id);
    }
    return result;
  }

  throw new AppError(409, 'INVALID_STATUS', `Cannot withdraw a ${request.status} request`);
}

async function getMyRequests(riderId) {
  return repo.getMyRequests(riderId);
}

async function joinWaitlist(tripId, riderId) {
  const trip = await ridesRepo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.status !== 'scheduled') throw new AppError(409, 'NOT_AVAILABLE', 'Trip is not available');
  if (trip.driver_id === riderId) throw new AppError(400, 'OWN_TRIP', 'Cannot waitlist your own trip');

  const existing = await repo.findWaitlistEntry(tripId, riderId);
  if (existing) throw new AppError(409, 'ALREADY_WAITLISTED', 'Already on waitlist');

  const existingReq = await repo.findRequestByTripAndRider(tripId, riderId);
  if (existingReq && ['pending', 'approved'].includes(existingReq.status)) {
    throw new AppError(409, 'ALREADY_REQUESTED', 'You already have an active request');
  }

  return repo.joinWaitlist(tripId, riderId);
}

async function leaveWaitlist(waitlistId, riderId) {
  const entry = await repo.findWaitlistById(waitlistId);
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Waitlist entry not found');
  if (entry.rider_id !== riderId) throw new AppError(403, 'FORBIDDEN', 'Not your waitlist entry');

  const result = await repo.leaveWaitlist(waitlistId);
  if (!result) throw new AppError(409, 'CANNOT_LEAVE', 'Cannot leave waitlist');
  return result;
}

async function acceptWaitlistOffer(waitlistId, riderId) {
  const entry = await repo.findWaitlistById(waitlistId);
  if (!entry) throw new AppError(404, 'NOT_FOUND', 'Waitlist entry not found');
  if (entry.rider_id !== riderId) throw new AppError(403, 'FORBIDDEN', 'Not your waitlist entry');
  if (entry.status !== 'offered') throw new AppError(409, 'NOT_OFFERED', 'No active offer');

  const result = await repo.acceptWaitlistOffer(waitlistId);
  if (!result) throw new AppError(409, 'OFFER_EXPIRED', 'Offer has expired or no seats available');
  return result;
}

async function getNotifications(userId, unreadOnly) {
  return notificationService.getNotifications(userId, unreadOnly);
}

async function markNotificationRead(notificationId, userId) {
  return notificationService.markRead(notificationId, userId);
}

async function markAllNotificationsRead(userId) {
  return notificationService.markAllRead(userId);
}

module.exports = {
  findMatches, requestSeat, withdrawRequest, getMyRequests,
  joinWaitlist, leaveWaitlist, acceptWaitlistOffer,
  getNotifications, markNotificationRead, markAllNotificationsRead,
};
