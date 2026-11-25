const AppError = require('../../utils/AppError');
const repo = require('./repository');
const ridesRepo = require('../rides/repository');

async function getHistory(userId, role) {
  return repo.getHistory(userId, role);
}

async function completeTrip(tripId, driverId) {
  const trip = await ridesRepo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
  if (trip.status !== 'scheduled') throw new AppError(409, 'INVALID_STATUS', `Trip is ${trip.status}`);

  const result = await repo.completeTrip(tripId);
  if (!result) throw new AppError(409, 'COMPLETE_FAILED', 'Could not complete trip');
  return result;
}

async function getReliability(userId) {
  return repo.getReliability(userId);
}

async function getBadges(userId) {
  return repo.getBadges(userId);
}

module.exports = { getHistory, completeTrip, getReliability, getBadges };
