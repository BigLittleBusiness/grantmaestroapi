import express from 'express'
import protect from '../../middlewares/auth.js'
import { assignTaskValidation, updateTaskValidation } from '../../middlewares/taskValidator.js'

const taskRouter = express.Router()

import {
  assignTask,
  fetchTaskList,
  updateTask,
  updateTaskStatus,
  removeTask,
  getTaskDetails,
  fetchGrantRelatedTaskList,
} from '../../controllers/taskController.js'

/**
 * @swagger
 * /v1/task/task-assign:
 *   post:
 *     summary: Assign a task to a team member
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               grant_id:
 *                 type: string
 *                 description: ID of the grant
 *               task_description:
 *                 type: string
 *                 description: Description of the task
 *               task_assigned_to:
 *                 type: string
 *                 description: ID of the team member
 *               targeted_completion_date:
 *                 type: string
 *                 format: date
 *                 description: Targeted completion date of the task
 *     responses:
 *       200:
 *         description: Task assigned successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.post('/task-assign', protect, assignTaskValidation, assignTask)

/**
 * @swagger
 * /v1/task/task-update/{task_id}:
 *   post:
 *     summary: Update an existing task
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the task to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               task_description:
 *                 type: string
 *               task_status:
 *                 type: string
 *               task_assigned_to:
 *                 type: string
 *               targeted_completion_date:
 *                 type: string
 *                 format: date
 *               grant_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.post('/task-update/:task_id', protect, updateTaskValidation, updateTask)

/**
 * @swagger
 * /v1/task/task-status-update/{task_id}:
 *   post:
 *     summary: Update the status of a task
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the task to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               task_status:
 *                 type: string
 *                 description: New status of the task
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.post('/task-status-update/:task_id', protect, updateTaskStatus)

/**
 * @swagger
 * /v1/task/task-list:
 *   get:
 *     summary: Fetch the list of tasks
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tasks retrieved successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.get('/task-list', protect, fetchTaskList)

/**
 * @swagger
 * /v1/task/task-details/{task_id}:
 *   get:
 *     summary: Get details of a specific task
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the task
 *     responses:
 *       200:
 *         description: Task details retrieved successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.get('/task-details/:task_id', protect, getTaskDetails)

/**
 * @swagger
 * /v1/task/task-remove/{task_id}:
 *   delete:
 *     summary: Remove a task by marking it as deleted
 *     tags: [Task]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: task_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the task to remove
 *     responses:
 *       200:
 *         description: Task removed successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.delete('/task-remove/:task_id', protect, removeTask)

/**
 * @swagger
 * /v1/task/grant-task-list/{grant_id}:
 *   get:
 *     summary: Fetch the list of tasks related to a specific grant
 *     tags: [Task]
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
 *         description: List of related tasks retrieved successfully
 *       401:
 *         description: Unauthorized
 */
taskRouter.get('/grant-task-list/:grant_id', protect, fetchGrantRelatedTaskList)

export default taskRouter
