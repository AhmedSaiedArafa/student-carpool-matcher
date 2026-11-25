const { Router } = require('express');
const ctrl = require('../src/modules/history/controller');
const { authenticate, requireRole, requireVerified } = require('../src/middleware/auth');
const validate = require('../src/middleware/validate');
const { createRatingSchema } = require('../src/modules/history/validation');
const { asyncHandler } = require('../src/middleware/errorHandler');

const router = Router();

router.get('/history', authenticate, asyncHandler(ctrl.getHistory));
router.patch('/trips/:id/complete', authenticate, requireVerified, requireRole('driver'), asyncHandler(ctrl.completeTrip));
router.get('/users/:id/reliability', authenticate, asyncHandler(ctrl.getReliability));
router.get('/users/:id/badges', authenticate, asyncHandler(ctrl.getBadges));
router.post('/trips/:id/ratings', authenticate, requireVerified, validate(createRatingSchema), asyncHandler(ctrl.createRating));
router.get('/trips/:id/ratings/pending', authenticate, asyncHandler(ctrl.getPendingRatings));
router.get('/users/:id/ratings', authenticate, asyncHandler(ctrl.getUserRatings));

module.exports = router;
