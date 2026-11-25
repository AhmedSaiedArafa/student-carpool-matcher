const { Router } = require('express');
const authRoutes = require('./auth');
const ridesRoutes = require('./rides');
const matchingRoutes = require('./matching');
const historyRoutes = require('./history');
const tripsRoutes = require('./trips');
const { pool } = require('../src/db');
const { asyncHandler } = require('../src/middleware/errorHandler');

const router = Router();

router.use('/auth', authRoutes);
router.use('/rides', ridesRoutes);
router.use('/', matchingRoutes);
router.use('/', historyRoutes);
router.use('/', tripsRoutes);

router.get('/stats', asyncHandler(async (req, res) => {
  const [members, journeys, fare, rating] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users WHERE email_verified = true'),
    pool.query("SELECT COUNT(*) FROM trip_instances WHERE status = 'completed'"),
    pool.query('SELECT COALESCE(ROUND(AVG(fare)::numeric, 0), 0) AS avg_fare FROM ride_templates WHERE fare IS NOT NULL AND fare > 0'),
    pool.query('SELECT COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_rating FROM ratings'),
  ]);
  res.json({
    data: {
      verified_members: parseInt(members.rows[0].count),
      completed_journeys: parseInt(journeys.rows[0].count),
      average_fare: parseFloat(fare.rows[0].avg_fare),
      average_rating: parseFloat(rating.rows[0].avg_rating),
    },
  });
}));

module.exports = router;
