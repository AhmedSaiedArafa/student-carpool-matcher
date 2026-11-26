const service = require('./service');
const AppError = require('../../utils/AppError');

function parseId(params) {
  const id = parseInt(params.id);
  if (isNaN(id) || id < 1) throw new AppError(400, 'INVALID_ID', 'Invalid ID');
  return id;
}

async function getHistory(req, res) {
  const history = await service.getHistory(req.user.id, req.user.role);
  res.json({ data: history });
}

async function completeTrip(req, res) {
  const trip = await service.completeTrip(parseId(req.params), req.user.id, req.body.attendance);
  res.json({ data: trip });
}

async function getReliability(req, res) {
  const reliability = await service.getReliability(parseId(req.params));
  res.json({ data: reliability });
}

async function getBadges(req, res) {
  const badges = await service.getBadges(parseId(req.params));
  res.json({ data: badges });
}

async function createRating(req, res) {
  const rating = await service.createRating(
    parseId(req.params), req.user.id,
    req.body.subject_id, req.body.score, req.body.comment
  );
  res.status(201).json({ data: rating });
}

async function getPendingRatings(req, res) {
  const pending = await service.getPendingRatings(parseId(req.params), req.user.id);
  res.json({ data: pending });
}

async function getUserRatings(req, res) {
  const ratings = await service.getUserRatings(parseId(req.params));
  res.json({ data: ratings });
}

async function exportHistory(req, res) {
  const result = await service.exportHistory(req.user.id, req.user.role);
  res.status(201).json({ data: result });
}

async function listExports(req, res) {
  const list = await service.listExports(req.user.id);
  res.json({ data: list });
}

module.exports = { getHistory, completeTrip, getReliability, getBadges, createRating, getPendingRatings, getUserRatings, exportHistory, listExports };
