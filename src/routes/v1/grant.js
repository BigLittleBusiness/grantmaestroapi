import express from 'express'
import commonHelper from '../../utils/commonHelper.js'
import protect from '../../middlewares/auth.js'

import {
  addGrant,
  updateGrant,
  grantList,
  getGrantDetails,
  manageGrantNote,
  manageGrantReport,
  removeReportItem,
  manageGrantExpense,
  removeExpenseItem,
} from '../../controllers/grantController.js'

const grantRouter = express.Router()

/**
 * @swagger
 * /v1/grant/grant-add:
 *   post:
 *     summary: Add a new grant
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category_id:
 *                 type: string
 *               grant_title:
 *                 type: string
 *               closing_date:
 *                 type: string
 *                 format: date
 *               origination_url:
 *                 type: string
 *               fund_originator:
 *                 type: string
 *               max_fund_amount:
 *                 type: number
 *               funding_sought_amount:
 *                 type: number
 *               finding_note:
 *                 type: string
 *               opening_date:
 *                 type: string
 *                 format: date
 *               note_type:
 *                 type: number
 *     responses:
 *       200:
 *         description: Grant added successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.post('/grant-add', protect, addGrant)

/**
 * @swagger
 * /v1/grant/grant-update/{grant_id}:
 *   post:
 *     summary: Update an existing grant
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: grant_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the grant to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               category_id:
 *                 type: string
 *               grant_title:
 *                 type: string
 *               origination_url:
 *                 type: string
 *               fund_originator:
 *                 type: string
 *               max_fund_amount:
 *                 type: number
 *               funding_sought_amount:
 *                 type: number
 *               finding_note:
 *                 type: string
 *               report_file:
 *                 type: string
 *                 format: binary
 *               report_template_file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Grant updated successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.post(
  '/grant-update/:grant_id',
  commonHelper.imageUpload.fields([
    { name: 'report_file', maxCount: 1 },
    { name: 'report_template_file', maxCount: 1 },
    { name: 'related_files', maxCount: 5 },
  ]),
  protect,
  updateGrant
)

/**
 * @swagger
 * /v1/grant/grant-list:
 *   get:
 *     summary: Fetch the list of grants
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of grants retrieved successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.get('/grant-list', protect, grantList)

/**
 * @swagger
 * /v1/grant/grant-details/{grant_id}:
 *   get:
 *     summary: Get details of a specific grant
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: grant_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the grant
 *     responses:
 *       200:
 *         description: Grant details retrieved successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.get('/grant-details/:grant_id', protect, getGrantDetails)

/**
 * @swagger
 * /v1/grant/grant-notes-manage:
 *   post:
 *     summary: Manage a grant note (add or update)
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note_id:
 *                 type: string
 *               note_type:
 *                 type: number
 *               note:
 *                 type: string
 *               grant_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Grant note managed successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.post('/grant-notes-manage', protect, manageGrantNote)

/**
 * @swagger
 * /v1/grant/grant-report-manage:
 *   post:
 *     summary: Manage a grant report (add or update)
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               report_id:
 *                 type: string
 *               report_title:
 *                 type: string
 *               report_submission_date:
 *                 type: string
 *                 format: date
 *               report_status:
 *                 type: string
 *               report_template_received:
 *                 type: string
 *               report_file:
 *                 type: string
 *                 format: binary
 *               report_template_file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Grant report managed successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.post(
  '/grant-report-manage',
  commonHelper.imageUpload.fields([
    { name: 'report_file', maxCount: 1 },
    { name: 'report_template_file', maxCount: 1 },
  ]),
  protect,
  manageGrantReport
)

/**
 * @swagger
 * /v1/grant/grant-report-remove/{report_id}:
 *   delete:
 *     summary: Remove a grant report
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: report_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the report to remove
 *     responses:
 *       200:
 *         description: Grant report removed successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.delete('/grant-report-remove/:report_id', protect, removeReportItem)

/**
 * @swagger
 * /v1/grant/grant-expense-manage:
 *   post:
 *     summary: Manage a grant expense (add or update)
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expense_id:
 *                 type: string
 *               grant_id:
 *                 type: string
 *               expense_description:
 *                 type: string
 *               expense_amount:
 *                 type: number
 *               expense_date:
 *                 type: string
 *                 format: date
 *               expense_payee:
 *                 type: string
 *               expense_paid_by:
 *                 type: string
 *     responses:
 *       200:
 *         description: Grant expense managed successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.post('/grant-expense-manage', protect, manageGrantExpense)

/**
 * @swagger
 * /v1/grant/grant-expense-remove/{expense_id}:
 *   delete:
 *     summary: Remove a grant expense
 *     tags: [Grant]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: expense_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the expense to remove
 *     responses:
 *       200:
 *         description: Grant expense removed successfully
 *       401:
 *         description: Unauthorized
 */
grantRouter.delete(
  '/grant-expense-remove/:expense_id',
  protect,
  removeExpenseItem
)

export default grantRouter
