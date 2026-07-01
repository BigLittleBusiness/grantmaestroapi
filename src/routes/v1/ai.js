import express from 'express'
import protect from '../../middlewares/auth.js'
import {
  scoreSuitability,
  generateTaskDescription,
  draftNote,
} from '../../controllers/aiController.js'

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered grant assistance endpoints
 */

/**
 * @route  POST /v1/ai/suitability
 * @desc   Score how suitable a grant opportunity is for the organisation
 * @access Private
 */
router.post('/suitability', protect, scoreSuitability)

/**
 * @route  POST /v1/ai/task-description
 * @desc   Generate a task description for a grant-related task
 * @access Private
 */
router.post('/task-description', protect, generateTaskDescription)

/**
 * @route  POST /v1/ai/draft-note
 * @desc   Draft an internal grant note (finding, suitability, submission, outcome, financial)
 * @access Private
 */
router.post('/draft-note', protect, draftNote)

export default router
