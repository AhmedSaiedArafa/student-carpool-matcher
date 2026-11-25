const { Router } = require('express');
const ctrl = require('./controller');
const { authenticate, requireRole, requireVerified } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { createRideSchema } = require('./validation');

const router = Router();

router.post('/', authenticate, requireVerified, requireRole('driver'), validate(createRideSchema), ctrl.createRide);
router.get('/mine', authenticate, requireRole('driver'), ctrl.getMyRides);
router.patch('/:id', authenticate, requireVerified, requireRole('driver'), ctrl.updateRide);
router.patch('/:id/status', authenticate, requireVerified, requireRole('driver'), ctrl.updateRideStatus);

module.exports = router;
