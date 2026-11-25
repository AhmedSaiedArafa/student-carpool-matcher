const { Router } = require('express');
const ctrl = require('./controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const { registerSchema, loginSchema } = require('./validation');

const router = Router();

router.post('/register', validate(registerSchema), ctrl.register);
router.post('/login', validate(loginSchema), ctrl.login);
router.get('/verify/:token', ctrl.verifyEmail);
router.get('/profile', authenticate, ctrl.getProfile);

module.exports = router;
