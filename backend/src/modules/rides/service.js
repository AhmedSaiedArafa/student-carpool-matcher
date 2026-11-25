const AppError = require('../../utils/AppError');
const { transaction } = require('../../db');
const repo = require('./repository');
const notificationService = require('../matching/notificationService');

const MAX_TRIPS_PER_RIDE = 60;
const MAX_END_DATE_MONTHS = 3;

function parseDuration(duration, startDate) {
  const d = new Date(startDate);
  switch (duration) {
    case '1w': d.setDate(d.getDate() + 6); return d;
    case '2w': d.setDate(d.getDate() + 13); return d;
    case '1m': d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); return d;
    case '3m': d.setMonth(d.getMonth() + 3); d.setDate(d.getDate() - 1); return d;
    default: return null;
  }
}

function validateSchedule(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (data.schedule_type === 'once') {
    if (!data.trip_date) throw new AppError(400, 'VALIDATION_ERROR', 'trip_date is required for one-time rides');
    const tripDate = new Date(data.trip_date);
    if (isNaN(tripDate.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'trip_date must be a valid date');
    if (tripDate < today) throw new AppError(400, 'VALIDATION_ERROR', 'trip_date cannot be in the past');
    return { weekdays: [tripDate.getDay()], startDate: data.trip_date, endDate: data.trip_date };
  }

  if (!Array.isArray(data.weekdays) || data.weekdays.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'weekdays must be a non-empty array for weekly rides');
  }
  for (const wd of data.weekdays) {
    const n = parseInt(wd);
    if (isNaN(n) || n < 0 || n > 6) throw new AppError(400, 'VALIDATION_ERROR', 'Each weekday must be 0 (Sun) to 6 (Sat)');
  }
  const weekdays = [...new Set(data.weekdays.map(w => parseInt(w)))].sort();

  if (!data.start_date) throw new AppError(400, 'VALIDATION_ERROR', 'start_date is required for weekly rides');
  const startDate = new Date(data.start_date);
  if (isNaN(startDate.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'start_date must be a valid date');
  if (startDate < today) throw new AppError(400, 'VALIDATION_ERROR', 'start_date cannot be in the past');

  let endDate;
  if (data.duration) {
    const parsed = parseDuration(data.duration, data.start_date);
    if (!parsed) throw new AppError(400, 'VALIDATION_ERROR', 'duration must be one of: 1w, 2w, 1m, 3m');
    endDate = parsed;
  } else if (data.end_date) {
    endDate = new Date(data.end_date);
    if (isNaN(endDate.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'end_date must be a valid date');
  } else {
    throw new AppError(400, 'VALIDATION_ERROR', 'Either end_date or duration is required for weekly rides');
  }

  if (endDate < startDate) throw new AppError(400, 'VALIDATION_ERROR', 'end_date must be after start_date');
  const maxEnd = new Date(startDate);
  maxEnd.setMonth(maxEnd.getMonth() + MAX_END_DATE_MONTHS);
  if (endDate > maxEnd) throw new AppError(400, 'VALIDATION_ERROR', 'end_date cannot be more than 3 months after start_date');

  const endStr = endDate.toISOString().split('T')[0];
  return { weekdays, startDate: data.start_date, endDate: endStr };
}

function generateDates(weekdays, startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const d = new Date(start);
  while (d <= end) {
    if (weekdays.includes(d.getDay())) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

async function createRide(driverId, data) {
  const schedule = validateSchedule(data);

  const dates = generateDates(schedule.weekdays, schedule.startDate, schedule.endDate);
  if (dates.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'No trips would be created with this schedule');
  if (dates.length > MAX_TRIPS_PER_RIDE) throw new AppError(400, 'VALIDATION_ERROR', `Schedule would create ${dates.length} trips, max is ${MAX_TRIPS_PER_RIDE}`);

  const template = await repo.createTemplate({
    ...data,
    driver_id: driverId,
    weekday: schedule.weekdays[0],
    weekdays: schedule.weekdays,
    start_date: schedule.startDate,
    end_date: schedule.endDate,
  });

  const instances = [];
  for (const dateStr of dates) {
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

  return { template, instances };
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
    'destination_name', 'weekday', 'departure_time', 'seats_total', 'fare', 'pickup_area_radius_km', 'stops',
    'weekdays', 'end_date'];
  const updates = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) updates[key] = fields[key];
  }

  if (fields.weekdays !== undefined || fields.end_date !== undefined) {
    const newWeekdays = fields.weekdays ? [...new Set(fields.weekdays.map(w => parseInt(w)))].sort() : (template.weekdays || [template.weekday]);
    const newEndDate = fields.end_date || template.end_date;

    if (newEndDate) {
      const maxEnd = new Date(template.start_date || template.created_at);
      maxEnd.setMonth(maxEnd.getMonth() + MAX_END_DATE_MONTHS);
      if (new Date(newEndDate) > maxEnd) throw new AppError(400, 'VALIDATION_ERROR', 'end_date cannot be more than 3 months after start_date');
    }

    if (fields.weekdays) {
      const oldWeekdays = template.weekdays || [template.weekday];
      const removed = oldWeekdays.filter(w => !newWeekdays.includes(w));
      if (removed.length > 0) {
        await repo.deleteFutureTripsWithoutPassengers(templateId, removed);
      }
      updates.weekday = newWeekdays[0];
    }

    if (newEndDate && template.schedule_type === 'weekly') {
      const startDate = template.start_date || template.created_at.toISOString().split('T')[0];
      const dates = generateDates(newWeekdays, startDate, newEndDate);
      if (dates.length > MAX_TRIPS_PER_RIDE) throw new AppError(400, 'VALIDATION_ERROR', `Schedule would create ${dates.length} trips, max is ${MAX_TRIPS_PER_RIDE}`);

      const today = new Date().toISOString().split('T')[0];
      for (const dateStr of dates) {
        if (dateStr < today) continue;
        const departure_at = `${dateStr}T${template.departure_time}`;
        try {
          await repo.createTripInstance({
            ride_template_id: templateId,
            trip_date: dateStr,
            departure_at,
            seats_remaining: template.seats_total,
          });
        } catch (err) {
          if (err.code === '23505') continue;
          throw err;
        }
      }
    }
  }

  if (updates.seats_total !== undefined) {
    const bookedCount = await repo.countApprovedRidersForFutureTrips(templateId);
    if (updates.seats_total < bookedCount) {
      throw new AppError(409, 'SEATS_BELOW_BOOKED', `Cannot reduce seats below ${bookedCount} already booked riders`);
    }
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
    const request = await repo.findRequestByIdForUpdate(requestId, client);
    if (!request) throw new AppError(404, 'NOT_FOUND', 'Request not found');
    if (request.driver_id !== driverId) throw new AppError(403, 'FORBIDDEN', 'Not your trip');
    if (request.status !== 'pending') throw new AppError(409, 'ALREADY_DECIDED', 'Request already decided');
    if (request.trip_status !== 'scheduled') throw new AppError(409, 'TRIP_NOT_SCHEDULED', 'Trip is not scheduled');

    if (decision === 'approved') {
      const updated = await repo.decrementSeats(request.trip_id, client);
      if (!updated) throw new AppError(409, 'NO_SEATS', 'No seats available');
    }

    const result = await repo.decideRequest(requestId, decision, client);
    if (!result) throw new AppError(409, 'ALREADY_DECIDED', 'Request already decided');
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
