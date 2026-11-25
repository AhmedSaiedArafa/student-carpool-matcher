const { Router } = require('express');
const ctrl = require('../src/modules/rides/controller');
const { authenticate, requireRole, requireVerified } = require('../src/middleware/auth');
const validate = require('../src/middleware/validate');
const { createRideSchema } = require('../src/modules/rides/validation');
const { asyncHandler } = require('../src/middleware/errorHandler');

const router = Router();

router.post('/', authenticate, requireVerified, requireRole('driver'), validate(createRideSchema), asyncHandler(ctrl.createRide));
router.get('/mine', authenticate, requireRole('driver'), asyncHandler(ctrl.getMyRides));
router.patch('/:id', authenticate, requireVerified, requireRole('driver'), asyncHandler(ctrl.updateRide));
router.patch('/:id/status', authenticate, requireVerified, requireRole('driver'), asyncHandler(ctrl.updateRideStatus));

module.exports = router;
