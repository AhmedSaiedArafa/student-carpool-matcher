const { Router } = require('express');
const ctrl = require('../src/modules/auth/controller');
const validate = require('../src/middleware/validate');
const { authenticate } = require('../src/middleware/auth');
const { registerSchema, loginSchema } = require('../src/modules/auth/validation');
const { asyncHandler } = require('../src/middleware/errorHandler');

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(ctrl.register));
router.post('/login', validate(loginSchema), asyncHandler(ctrl.login));
router.get('/verify/:token', asyncHandler(ctrl.verifyEmail));
router.get('/profile', authenticate, asyncHandler(ctrl.getProfile));

module.exports = router;
