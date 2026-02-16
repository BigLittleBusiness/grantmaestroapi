import express from 'express'
import protect from '../../middlewares/auth.js'

import { getCalendarEvents, getOrganizationList } from '../../controllers/adminController.js'

const dashboardRouter = express.Router()

/**
 * @swagger
 * /v1/dashboard/calendar-events:
 *   get:
 *     summary: Retrieve calendar events
 *     tags: [Dashboard]
 *     operationId: getCalendarEvents
 *     description: Fetch a list of calendar events. Requires authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved calendar events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
dashboardRouter.get('/calendar-events', protect, getCalendarEvents)

/**
 * @swagger
 * /v1/dashboard/organization-list:
 *   get:
 *     summary: List of registered organizations
 *     tags: [Dashboard]
 *     operationId: getOrganizationList
 *     description: Fetch a list of organizations. Requires authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved organization list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   organization_id:
 *                     type: string
 *                   organization_name:
 *                     type: string
 *                   abn_no:
 *                     type: string
 *                   organization_website:
 *                      type: string   
 *                   phone_no:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
dashboardRouter.get('/organization-list', protect, getOrganizationList)

export default dashboardRouter
