const { Router } = require('express');
const ctrl = require('./controller');
const { authenticate, requireRole, requireVerified } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { createRideSchema, updateRideSchema } = require('./validation');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = Router();

router.post('/', authenticate, requireVerified, requireRole('driver'), validate(createRideSchema), asyncHandler(ctrl.createRide));
router.get('/mine', authenticate, requireRole('driver'), asyncHandler(ctrl.getMyRides));
router.patch('/:id', authenticate, requireVerified, requireRole('driver'), validate(updateRideSchema), asyncHandler(ctrl.updateRide));
router.patch('/:id/status', authenticate, requireVerified, requireRole('driver'), asyncHandler(ctrl.updateRideStatus));

module.exports = router;
