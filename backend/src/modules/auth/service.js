const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('../../config/env');
const AppError = require('../../utils/AppError');
const repo = require('./repository');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '24h';

async function register({ university_email, password, name, role }) {
  const existing = await repo.findByEmail(university_email);
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }

  if (!university_email.endsWith('.edu') && !university_email.endsWith('.ac') && !university_email.includes('.edu.')) {
    throw new AppError(400, 'INVALID_EMAIL', 'Please use a university email address (.edu)');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const verification_token = crypto.randomBytes(32).toString('hex');
  const user = await repo.create({ university_email, password_hash, name, role, verification_token });

  return { user, verification_token };
}

async function login({ university_email, password }) {
  const user = await repo.findByEmail(university_email);
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, emailVerified: user.email_verified },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    token,
    user: { id: user.id, university_email: user.university_email, name: user.name, role: user.role, email_verified: user.email_verified }
  };
}

async function verifyEmail(token) {
  const user = await repo.verifyEmail(token);
  if (!user) {
    throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired verification token');
  }
  return user;
}

async function getProfile(userId) {
  const user = await repo.findById(userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}

module.exports = { register, login, verifyEmail, getProfile };
