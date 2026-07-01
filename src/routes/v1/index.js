import express from 'express'
import grantRouter from './grant.js'
import taskRouter from './task.js'
import categoryRouter from './category.js'
import dashboardRouter from './dashboard.js'
import subscriptionRouter from './subscription.js'
import teamMemberRouter from './teamMember.js'
import ticketRouter from './ticket.js'
import authRouter from './auth.js'
import adminRouter from './admin.js'
import aiRouter from './ai.js'

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Grant
 *   description: API for managing grant
 */
router.use('/grant', grantRouter)

/**
 * @swagger
 * tags:
 *   name: Task
 *   description: API for managing Task
 */
router.use('/task', taskRouter)

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: API for managing grant categories
 */
router.use('/category', categoryRouter)

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: API for managing Dashboard data
 */
router.use('/dashboard', dashboardRouter)

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: API for managing Subscription data
 */
router.use('/subscription', subscriptionRouter)

/**
 * @swagger
 * tags:
 *   name: Team Member
 *   description: API for managing Team Member data
 */
router.use('/team-member', teamMemberRouter)

/**
 * @swagger
 * tags:
 *   name: Ticket
 *   description: API for managing Ticket data
 */
router.use('/ticket', ticketRouter)

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API for Auth data
 */
router.use('/auth', authRouter)

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: System administration endpoints (Super Admin only)
 */
router.use('/admin', adminRouter)

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered grant assistance endpoints
 */
router.use('/ai', aiRouter)

export default router
