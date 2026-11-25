const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  ORS_API_KEY: process.env.ORS_API_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5500',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  BADGE_TRUSTED_MIN_TRIPS: parseInt(process.env.BADGE_TRUSTED_MIN_TRIPS, 10) || 5,
};
