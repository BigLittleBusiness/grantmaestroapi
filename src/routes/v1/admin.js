/**
 * admin.js – System Admin routes
 *
 * All routes here require the user to be authenticated AND to be a
 * Super Admin (user_type = 1).  Access is enforced by the `protect`
 * middleware via routeAccessHelper.js.
 */
import express from 'express'
import protect from '../../middlewares/auth.js'
import {
  savePinSettings,
  fetchPinSettings,
  testPinConnection,
} from '../../controllers/pinPaymentController.js'
import {
  listPlans,
  updatePlan,
  listPromoCodes,
  createPromoCode,
  deletePromoCode,
} from '../../controllers/adminPlansController.js'

const adminRouter = express.Router()

/**
 * @swagger
 * /v1/admin/pin-settings/save:
 *   post:
 *     summary: Save Pin Payments credentials (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
adminRouter.post('/pin-settings/save', protect, savePinSettings)

/**
 * @swagger
 * /v1/admin/pin-settings/fetch:
 *   get:
 *     summary: Retrieve Pin Payments configuration (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
adminRouter.get('/pin-settings/fetch', protect, fetchPinSettings)

/**
 * @swagger
 * /v1/admin/pin-settings/test-connection:
 *   get:
 *     summary: Test the stored Pin Payments credentials (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
adminRouter.get('/pin-settings/test-connection', protect, testPinConnection)

// ── Subscription Plans ──────────────────────────────────────────────────────
adminRouter.get('/plans', protect, listPlans)
adminRouter.put('/plans/:plan_id', protect, updatePlan)

// ── Promo Codes ──────────────────────────────────────────────────────────────
adminRouter.get('/promo-codes', protect, listPromoCodes)
adminRouter.post('/promo-codes', protect, createPromoCode)
adminRouter.delete('/promo-codes/:promo_id', protect, deletePromoCode)

export default adminRouter
