import express from 'express'
import protect from '../../middlewares/auth.js'
import commonHelper from '../../utils/commonHelper.js'

import {
  fetchTicketList,
  getTicketDetail,
  manageTicket,
  removeTicket,
  updateTicketStatus,
} from '../../controllers/ticketController.js'

const ticketRouter = express.Router()

/**
 * @swagger
 * /v1/ticket/ticket-list:
 *   get:
 *     summary: Fetch the list of support tickets
 *     tags: [Ticket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the list of tickets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     tickets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ticket_id:
 *                             type: string
 *                           ticket_title:
 *                             type: string
 *                           ticket_description:
 *                             type: string
 *                           ticket_file_path:
 *                             type: string
 *                           ticket_status:
 *                             type: string
 *                           organization_id:
 *                             type: string
 *       401:
 *         description: Unauthorized
 */
ticketRouter.get('/ticket-list', protect, fetchTicketList)

/**
 * @swagger
 * /v1/ticket/ticket-status-update/{ticket_id}:
 *   post:
 *     summary: Update the status of a support ticket
 *     tags: [Ticket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticket_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ticket to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticket_status:
 *                 type: string
 *                 description: The new status of the ticket
 *     responses:
 *       200:
 *         description: Ticket status updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
ticketRouter.post(
  '/ticket-status-update/:ticket_id',
  protect,
  updateTicketStatus
)

/**
 * @swagger
 * /v1/ticket/ticket-remove/{ticket_id}:
 *   delete:
 *     summary: Remove a support ticket
 *     tags: [Ticket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticket_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ticket to remove
 *     responses:
 *       200:
 *         description: Ticket removed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
ticketRouter.delete('/ticket-remove/:ticket_id', protect, removeTicket)

/**
 * @swagger
 * /v1/ticket/ticket-detail/{ticket_id}:
 *   get:
 *     summary: Get details of a specific support ticket
 *     tags: [Ticket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticket_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ticket
 *     responses:
 *       200:
 *         description: Ticket details retrieved successfully
 *       404:
 *         description: Ticket not found
 *       401:
 *         description: Unauthorized
 */
ticketRouter.get('/ticket-detail/:ticket_id', protect, getTicketDetail)

/**
 * @swagger
 * /v1/ticket/ticket-manage:
 *   post:
 *     summary: Create or update a support ticket
 *     tags: [Ticket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               ticket_id:
 *                 type: string
 *                 description: The ID of the ticket (optional for new tickets)
 *               ticket_title:
 *                 type: string
 *                 description: The title of the ticket
 *               ticket_description:
 *                 type: string
 *                 description: The description of the ticket
 *               support_ticket_file:
 *                 type: string
 *                 format: binary
 *                 description: The file associated with the ticket
 *     responses:
 *       200:
 *         description: Ticket managed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
ticketRouter.post(
  '/ticket-manage',
  commonHelper.imageUpload.fields([
    { name: 'support_ticket_file', maxCount: 1 },
  ]),
  protect,
  manageTicket
)

export default ticketRouter
