const AppError = require('../../utils/AppError');
const { transaction } = require('../../db');
const repo = require('./repository');
const notificationService = require('../matching/notificationService');

async function createRide(driverId, data) {
  const template = await repo.createTemplate({ ...data, driver_id: driverId });

  const instances = await generateUpcomingInstances(template);
  return { template, instances };
}

async function generateUpcomingInstances(template, weeksAhead = 4) {
  const instances = [];
  const today = new Date();
  for (let w = 0; w < weeksAhead; w++) {
    const date = new Date(today);
    date.setDate(today.getDate() + ((template.weekday + 7 - today.getDay()) % 7) + w * 7);
    if (date <= today && w === 0) {
      date.setDate(date.getDate() + 7);
    }
    const dateStr = date.toISOString().split('T')[0];
    const departure_at = `${dateStr}T${template.departure_time}`;
    try {
      const inst = await repo.createTripInstance({
        ride_template_id: template.id,
        trip_date: dateStr,
        departure_at,
        seats_remaining: template.seats_total,
      });
      instances.push(inst);
    } catch (err) {
      if (err.code === '23505') continue;
      throw err;
    }
  }
  return instances;
}

async function getMyRides(driverId) {
  const templates = await repo.findTemplatesByDriver(driverId);
  const result = [];
  for (const t of templates) {
    const trips = await repo.findTripsByTemplate(t.id);
    result.push({ ...t, trips });
  }
  return result;
}

async function updateRide(templateId, driverId, fields) {
  const template = await repo.findTemplateById(templateId);
  if (!template) throw new AppError(404, 'NOT_FOUND', 'Ride not found');
  if (template.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your ride');

  const allowed = ['origin_lat', 'origin_lng', 'origin_name', 'destination_lat', 'destination_lng',
    'destination_name', 'weekday', 'departure_time', 'seats_total', 'fare', 'pickup_area_radius_km', 'stops'];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }
  if (Object.keys(updates).length === 0) throw new AppError(400, 'NO_CHANGES', 'No valid fields to update');

  return repo.updateTemplate(templateId, updates);
}

async function updateRideStatus(templateId, driverId, status) {
  const template = await repo.findTemplateById(templateId);
  if (!template) throw new AppError(404, 'NOT_FOUND', 'Ride not found');
  if (template.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your ride');

  const transitions = { active: ['paused', 'cancelled'], paused: ['active', 'cancelled'] };
  if (!transitions[template.status]?.includes(status)) {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot change from ${template.status} to ${status}`);
  }
  return repo.updateTemplate(templateId, { status });
}

async function getTripDetails(tripId) {
  const trip = await repo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  return trip;
}

async function getTripRequests(tripId, driverId) {
  const trip = await repo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
  return repo.findRequestsByTrip(tripId);
}

async function getPassengers(tripId, driverId) {
  const trip = await repo.findTripById(tripId);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  if (trip.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
  return repo.findApprovedPassengers(tripId);
}

async function decideRequest(requestId, driverId, decision) {
  if (!['approved', 'rejected'].includes(decision)) {
    throw new AppError(400, 'INVALID_DECISION', 'Decision must be approved or rejected');
  }

  return transaction(async (client) => {
    const request = await repo.findRequestById(requestId);
    if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
    if (request.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
    if (request.status !== 'pending') throw new AppError(409, 'ALREADY_DECIDED', 'Request already decided');

    if (decision === 'approved') {
      const updated = await repo.decrementSeats(request.trip_id, client);
      if (!updated) throw new AppError(409, 'NO_SEATS', 'No seats available');
    }

    const result = await repo.decideRequest(requestId, decision, client);
    await notificationService.notifyRequestDecision(request.rider_id, request.trip_id, decision, request);
    return result;
  });
}

async function cancelTrip(tripId, driverId) {
  return transaction(async (client) => {
    const trip = await repo.findTripById(tripId);
    if (!trip) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
    if (trip.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
    if (trip.status !== 'scheduled') throw new AppError(409, 'INVALID_STATUS', `Trip is ${trip.status}`);

    await repo.updateTripStatus(tripId, 'cancelled');
    const affected = await repo.cancelTripRequests(tripId, client);

    for (const { rider_id } of affected) {
      await notificationService.notify(rider_id, 'trip_cancelled', 'A trip you were part of has been cancelled', tripId);
    }

    return { cancelled: true, affected_riders: affected.length };
  });
}

async function getDashboard(driverId) {
  return repo.getDriverDashboard(driverId);
}

module.exports = {
  createRide, getMyRides, updateRide, updateRideStatus,
  getTripDetails, getTripRequests, getPassengers, decideRequest,
  cancelTrip, getDashboard,
};
