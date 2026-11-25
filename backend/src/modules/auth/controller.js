const service = require('./service');

async function register(req, res) {
  const { user, verification_token } = await service.register(req.body);
  res.status(201).json({ data: user, verification_token });
}

async function login(req, res) {
  const result = await service.login(req.body);
  res.json({ data: result });
}

async function verifyEmail(req, res) {
  const user = await service.verifyEmail(req.params.token);
  res.json({ data: user, message: 'Email verified successfully' });
}

async function getProfile(req, res) {
  const user = await service.getProfile(req.user.id);
  res.json({ data: user });
}

module.exports = { register, login, verifyEmail, getProfile };
