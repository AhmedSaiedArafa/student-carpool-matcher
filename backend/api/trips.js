const { Router } = require('express');
const { authenticate, requireRole, requireVerified } = require('../src/middleware/auth');
const ridesCtrl = require('../src/modules/rides/controller');
const { asyncHandler } = require('../src/middleware/errorHandler');

const router = Router();

router.get('/trips/:id', authenticate, asyncHandler(ridesCtrl.getTripDetails));
router.get('/trips/:id/requests', authenticate, requireRole('driver'), asyncHandler(ridesCtrl.getTripRequests));
router.get('/trips/:id/passengers', authenticate, requireRole('driver'), asyncHandler(ridesCtrl.getPassengers));
router.patch('/trips/:id/status', authenticate, requireVerified, requireRole('driver'), asyncHandler(ridesCtrl.cancelTrip));
router.patch('/requests/:id/decision', authenticate, requireVerified, requireRole('driver'), asyncHandler(ridesCtrl.decideRequest));
router.get('/drivers/dashboard', authenticate, requireRole('driver'), asyncHandler(ridesCtrl.getDashboard));

module.exports = router;
