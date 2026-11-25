const { Router } = require('express');
const ctrl = require('./controller');
const { authenticate, requireVerified } = require('../../middleware/auth');

const router = Router();

router.get('/matches', authenticate, requireVerified, ctrl.findMatches);
router.post('/trips/:id/requests', authenticate, requireVerified, ctrl.requestSeat);
router.delete('/requests/:id', authenticate, ctrl.withdrawRequest);
router.get('/requests/mine', authenticate, ctrl.getMyRequests);
router.post('/trips/:id/waitlist', authenticate, requireVerified, ctrl.joinWaitlist);
router.delete('/waitlist/:id', authenticate, ctrl.leaveWaitlist);
router.post('/waitlist/:id/accept', authenticate, ctrl.acceptWaitlistOffer);
router.get('/notifications', authenticate, ctrl.getNotifications);
router.patch('/notifications/:id/read', authenticate, ctrl.markNotificationRead);
router.patch('/notifications/read-all', authenticate, ctrl.markAllNotificationsRead);

module.exports = router;
