const service = require('./service');
const AppError = require('../../utils/AppError');

function parseId(params) {
  const id = parseInt(params.id);
  if (isNaN(id)) throw new AppError(400, 'INVALID_ID', 'Invalid ID');
  return id;
}

async function createRide(req, res) {
  const result = await service.createRide(req.user.id, req.body);
  res.status(201).json({ data: result });
}

async function getMyRides(req, res) {
  const rides = await service.getMyRides(req.user.id);
  res.json({ data: rides });
}

async function updateRide(req, res) {
  const ride = await service.updateRide(parseId(req.params), req.user.id, req.body);
  res.json({ data: ride });
}

async function updateRideStatus(req, res) {
  const ride = await service.updateRideStatus(parseId(req.params), req.user.id, req.body.status);
  res.json({ data: ride });
}

async function getTripDetails(req, res) {
  const trip = await service.getTripDetails(parseId(req.params));
  res.json({ data: trip });
}

async function getTripRequests(req, res) {
  const requests = await service.getTripRequests(parseId(req.params), req.user.id);
  res.json({ data: requests });
}

async function getPassengers(req, res) {
  const passengers = await service.getPassengers(parseId(req.params), req.user.id);
  res.json({ data: passengers });
}

async function decideRequest(req, res) {
  const result = await service.decideRequest(parseId(req.params), req.user.id, req.body.decision);
  res.json({ data: result });
}

async function cancelTrip(req, res) {
  const result = await service.cancelTrip(parseId(req.params), req.user.id);
  res.json({ data: result });
}

async function getDashboard(req, res) {
  const data = await service.getDashboard(req.user.id);
  res.json({ data });
}

module.exports = {
  createRide, getMyRides, updateRide, updateRideStatus,
  getTripDetails, getTripRequests, getPassengers, decideRequest,
  cancelTrip, getDashboard,
};
