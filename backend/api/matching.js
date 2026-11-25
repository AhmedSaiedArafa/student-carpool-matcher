const { Router } = require('express');
const ctrl = require('../src/modules/matching/controller');
const { authenticate, requireVerified } = require('../src/middleware/auth');
const { asyncHandler } = require('../src/middleware/errorHandler');

const router = Router();

router.get('/matches', authenticate, requireVerified, asyncHandler(ctrl.findMatches));
router.post('/trips/:id/requests', authenticate, requireVerified, asyncHandler(ctrl.requestSeat));
router.delete('/requests/:id', authenticate, asyncHandler(ctrl.withdrawRequest));
router.get('/requests/mine', authenticate, asyncHandler(ctrl.getMyRequests));
router.post('/trips/:id/waitlist', authenticate, requireVerified, asyncHandler(ctrl.joinWaitlist));
router.delete('/waitlist/:id', authenticate, asyncHandler(ctrl.leaveWaitlist));
router.post('/waitlist/:id/accept', authenticate, asyncHandler(ctrl.acceptWaitlistOffer));
router.get('/notifications', authenticate, asyncHandler(ctrl.getNotifications));
router.patch('/notifications/:id/read', authenticate, asyncHandler(ctrl.markNotificationRead));
router.patch('/notifications/read-all', authenticate, asyncHandler(ctrl.markAllNotificationsRead));

module.exports = router;
