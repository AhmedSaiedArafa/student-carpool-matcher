const { Router } = require('express');
const authRoutes = require('./auth');
const ridesRoutes = require('./rides');
const matchingRoutes = require('./matching');
const historyRoutes = require('./history');
const tripsRoutes = require('./trips');

const router = Router();

router.use('/auth', authRoutes);
router.use('/rides', ridesRoutes);
router.use('/', matchingRoutes);
router.use('/', historyRoutes);
router.use('/', tripsRoutes);

module.exports = router;
