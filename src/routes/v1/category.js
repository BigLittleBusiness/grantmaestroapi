import express from 'express'
import protect from '../../middlewares/auth.js'

import {
  getGrantCategoryList,
  manageCategory,
} from '../../controllers/categoryController.js'

const categoryRouter = express.Router()

/**
 * @swagger
 * /v1/category/grant-category-list:
 *   get:
 *     summary: Get the list of grant categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: [] # Requires bearer token
 *     responses:
 *       200:
 *         description: Successfully retrieved the list of grant categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: The category ID
 *                   name:
 *                     type: string
 *                     description: The category name
 *       401:
 *         description: Unauthorized
 */
categoryRouter.get('/grant-category-list', protect, getGrantCategoryList)

/**
 * @swagger
 * /v1/category/manage-grant-category:
 *   post:
 *     summary: Manage a grant category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: [] # Requires bearer token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The category ID (optional for new categories)
 *               name:
 *                 type: string
 *                 description: The category name
 *     responses:
 *       200:
 *         description: Successfully managed the grant category
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
categoryRouter.post('/manage-grant-category', protect, manageCategory)

export default categoryRouter
