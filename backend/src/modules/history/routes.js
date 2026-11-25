const { Router } = require('express');
const ctrl = require('./controller');
const { authenticate, requireRole, requireVerified } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = Router();

router.get('/history', authenticate, asyncHandler(ctrl.getHistory));
router.patch('/trips/:id/complete', authenticate, requireVerified, requireRole('driver'), asyncHandler(ctrl.completeTrip));

router.get('/users/:id/reliability', authenticate, asyncHandler(ctrl.getReliability));
router.get('/users/:id/badges', authenticate, asyncHandler(ctrl.getBadges));

module.exports = router;
