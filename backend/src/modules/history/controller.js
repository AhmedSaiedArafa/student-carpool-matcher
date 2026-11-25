const service = require('./service');
const AppError = require('../../utils/AppError');

function parseId(params) {
  const id = parseInt(params.id);
  if (isNaN(id)) throw new AppError(400, 'INVALID_ID', 'Invalid ID');
  return id;
}

async function getHistory(req, res) {
  const history = await service.getHistory(req.user.id, req.user.role);
  res.json({ data: history });
}

async function completeTrip(req, res) {
  const trip = await service.completeTrip(parseId(req.params), req.user.id);
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

module.exports = { getHistory, completeTrip, getReliability, getBadges };
