import express from 'express'
import protect from '../../middlewares/auth.js'
import {
  addTeamMember,
  fetchMemberList,
  getMemberDetails,
  getMemberInfo,
  removeTeamMember,
  updateTeamMember,
} from '../../controllers/teamMemberController.js'
import { addMemberValidation } from '../../middlewares/memberValidator.js'

const teamMemberRouter = express.Router()

/**
 * @swagger
 * /v1/team-member/member-details/{member_id}:
 *   get:
 *     summary: Get details of a specific team member
 *     tags: [Team Member]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: member_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team member
 *     responses:
 *       200:
 *         description: Team member details retrieved successfully
 */
teamMemberRouter.get('/member-details/:member_id', protect, getMemberDetails)

/**
 * @swagger
 * /v1/team-member/member-view/{member_id}:
 *   get:
 *     summary: Get information about a team member's tasks
 *     tags: [Team Member]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: member_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team member
 *     responses:
 *       200:
 *         description: Team member task information retrieved successfully
 */
teamMemberRouter.get('/member-view/:member_id', protect, getMemberInfo)

/**
 * @swagger
 * /v1/team-member/member-list:
 *   get:
 *     summary: Fetch list of team members
 *     tags: [Team Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of team members retrieved successfully
 */
teamMemberRouter.get('/member-list', protect, fetchMemberList)

/**
 * @swagger
 * /v1/team-member/member-remove/{member_id}:
 *   delete:
 *     summary: Remove a team member
 *     tags: [Team Member]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: member_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team member to remove
 *     responses:
 *       200:
 *         description: Team member removed successfully
 */
teamMemberRouter.delete('/member-remove/:member_id', protect, removeTeamMember)

/**
 * @swagger
 * /v1/team-member/member-update/{member_id}:
 *   post:
 *     summary: Update team member details
 *     tags: [Team Member]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: member_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team member to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               phone_no:
 *                 type: string
 *               member_type:
 *                 type: integer
 *               position_text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Team member updated successfully
 */
teamMemberRouter.post('/member-update/:member_id', protect, updateTeamMember)

/**
 * @swagger
 * /v1/team-member/member-add:
 *   post:
 *     summary: Add a new team member
 *     tags: [Team Member]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               address:
 *                 type: string
 *               email:
 *                 type: string
 *               position_text:
 *                 type: string
 *               position_id:
 *                 type: integer
 *               member_type:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Team member added successfully
 */
teamMemberRouter.post(
  '/member-add',
  protect,
  addMemberValidation,
  addTeamMember
)

export default teamMemberRouter
