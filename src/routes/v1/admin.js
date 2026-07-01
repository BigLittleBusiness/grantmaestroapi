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

export default adminRouter
