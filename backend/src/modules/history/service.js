const AppError = require('../../utils/AppError');
const { transaction } = require('../../db');
const repo = require('./repository');
const ridesRepo = require('../rides/repository');
const notificationService = require('../matching/notificationService');

async function getHistory(userId, role) {
  return repo.getHistory(userId, role);
}

async function completeTrip(tripId, driverId, attendance) {
  const trip = await ridesRepo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
  if (trip.status !== 'scheduled') throw new AppError(409, 'INVALID_STATUS', `Trip is ${trip.status}`);

  return transaction(async () => {
    const result = await repo.completeTrip(tripId);
    if (!result) throw new AppError(409, 'COMPLETE_FAILED', 'Could not complete trip');

    await repo.recordAttendance(tripId, driverId, true);

    if (Array.isArray(attendance)) {
      const approvedRiders = await repo.findApprovedRiders(tripId);
      const approvedIds = new Set(approvedRiders.map(r => r.id));
      for (const a of attendance) {
        const riderId = parseInt(a.rider_id);
        if (!Number.isInteger(riderId) || riderId < 1) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Each attendance item must have a valid rider_id');
        }
        if (!approvedIds.has(riderId)) {
          throw new AppError(400, 'VALIDATION_ERROR', `Rider ${riderId} is not an approved rider on this trip`);
        }
        if (typeof a.showed_up !== 'boolean') {
          throw new AppError(400, 'VALIDATION_ERROR', 'Each attendance item must have a boolean showed_up');
        }
        await repo.recordAttendance(tripId, riderId, a.showed_up);
      }
    }

    const riders = await repo.findApprovedRiders(tripId);
    const route = `${trip.origin_name || 'Origin'} → ${trip.destination_name || 'Destination'}`;
    for (const rider of riders) {
      await notificationService.notify(rider.id, 'trip_completed', `Your trip ${route} is complete. Rate your driver!`, tripId);
    }

    return result;
  });
}

async function createRating(tripId, authorId, subjectId, score, comment) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Score must be an integer between 1 and 5');
  }
  if (comment && comment.length > 300) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Comment must be at most 300 characters');
  }
  if (authorId === subjectId) {
    throw new AppError(400, 'INVALID_RATING_TARGET', 'You cannot rate yourself');
  }

  const trip = await ridesRepo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.status !== 'completed') throw new AppError(409, 'TRIP_NOT_COMPLETED', 'Trip is not completed');

  const authorPart = await repo.findTripParticipant(tripId, authorId);
  if (!authorPart) throw new AppError(403, 'NOT_A_PARTICIPANT', 'You are not a participant of this trip');
  const subjectPart = await repo.findTripParticipant(tripId, subjectId);
  if (!subjectPart) throw new AppError(403, 'NOT_A_PARTICIPANT', 'Subject is not a participant of this trip');

  let direction;
  if (authorPart.role === 'driver' && subjectPart.role === 'rider') {
    direction = 'driver_to_rider';
  } else if (authorPart.role === 'rider' && subjectPart.role === 'driver') {
    direction = 'rider_to_driver';
  } else {
    throw new AppError(400, 'INVALID_RATING_TARGET', 'Invalid rating direction');
  }

  try {
    const rating = await repo.createRating(tripId, authorId, subjectId, direction, score, comment);
    await notificationService.notify(subjectId, 'new_rating', `You received a ${score}★ rating`, tripId);
    return rating;
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(409, 'ALREADY_RATED', 'You have already rated this person on this trip');
    }
    throw err;
  }
}

async function getPendingRatings(tripId, userId) {
  const trip = await ridesRepo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.status !== 'completed') return [];
  return repo.findPendingRatings(tripId, userId);
}

async function getUserRatings(userId) {
  return repo.getUserRatings(userId);
}

async function getReliability(userId) {
  return repo.getReliability(userId);
}

async function getBadges(userId) {
  return repo.getBadges(userId);
}

function escapeCell(val) {
  let str = val == null ? '' : String(val);
  if (/^[=+\-@]/.test(str)) str = "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}

async function exportHistory(userId, role) {
  const rows = await repo.getHistory(userId, role);
  if (rows.length === 0) throw new AppError(404, 'NO_HISTORY', 'You have no trips to export yet');

  let header;
  let mapRow;
  if (role === 'driver') {
    header = ['Date', 'From', 'To', 'Trip status', 'Passengers', 'Fare (EGP)'];
    mapRow = r => [
      r.trip_date ? new Date(r.trip_date).toISOString().split('T')[0] : '',
      r.origin_name, r.destination_name, r.status,
      r.passenger_count, r.fare,
    ];
  } else {
    header = ['Date', 'From', 'To', 'Trip status', 'Your request', 'Driver', 'Fare (EGP)'];
    mapRow = r => [
      r.trip_date ? new Date(r.trip_date).toISOString().split('T')[0] : '',
      r.origin_name, r.destination_name, r.status,
      r.request_status, r.driver_name, r.fare,
    ];
  }

  const lines = [header.map(escapeCell).join(',')];
  for (const r of rows) {
    lines.push(mapRow(r).map(escapeCell).join(','));
  }
  const csv = lines.join('\r\n') + '\r\n';

  const exportStorage = require('./exportStorage');
  const { bucket, key } = await exportStorage.saveExport(userId, csv);
  return { bucket, key, rows: rows.length, csv };
}

async function listExports(userId) {
  const exportStorage = require('./exportStorage');
  return exportStorage.listExports(userId);
}

module.exports = { getHistory, completeTrip, getReliability, getBadges, createRating, getPendingRatings, getUserRatings, exportHistory, listExports };
