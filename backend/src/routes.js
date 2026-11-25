const { Router } = require('express');
const authRoutes = require('./modules/auth/routes');
const ridesRoutes = require('./modules/rides/routes');
const matchingRoutes = require('./modules/matching/routes');
const historyRoutes = require('./modules/history/routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/rides', ridesRoutes);
router.use('/', matchingRoutes);
router.use('/', historyRoutes);

// Trip-specific routes shared by rides module
const { authenticate, requireRole, requireVerified } = require('./middleware/auth');
const ridesCtrl = require('./modules/rides/controller');

router.get('/trips/:id', authenticate, ridesCtrl.getTripDetails);
router.get('/trips/:id/requests', authenticate, requireRole('driver'), ridesCtrl.getTripRequests);
router.get('/trips/:id/passengers', authenticate, requireRole('driver'), ridesCtrl.getPassengers);
router.patch('/trips/:id/status', authenticate, requireVerified, requireRole('driver'), ridesCtrl.cancelTrip);
router.patch('/requests/:id/decision', authenticate, requireVerified, requireRole('driver'), ridesCtrl.decideRequest);
router.get('/drivers/dashboard', authenticate, requireRole('driver'), ridesCtrl.getDashboard);

module.exports = router;
