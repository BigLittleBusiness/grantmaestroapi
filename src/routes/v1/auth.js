import express from 'express'
import commonHelper from '../../utils/commonHelper.js'
import protect from '../../middlewares/auth.js'
import {
  loginValidation,
  signupValidation,
  updateProfileValidation,
  changePassValidation,
  forgotPassValidation,
  resetPassValidation,
} from '../../middlewares/authValidator.js'
import {
  signup,
  forgotPassword,
  resetPassword,
  login,
  changePassword,
  viewProfile,
  updateProfile,
  generateAccessToken,
  logout,
  refreshTokenValidation,
  accessTokenValidation,
} from '../../controllers/authController.js'

const authRouter = express.Router()

/**
 * @swagger
 * /v1/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Successfully logged in
 *       401:
 *         description: Unauthorized
 */
authRouter.post('/login', loginValidation, login)

/**
 * @swagger
 * /v1/auth/refresh-token:
 *   get:
 *     summary: Generate a new access token using a refresh token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Access token generated successfully
 *       401:
 *         description: Unauthorized
 */
authRouter.get('/refresh-token', generateAccessToken)

/**
 * @swagger
 * /v1/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
authRouter.post('/logout', protect, logout)

/**
 * @swagger
 * /v1/auth/reset-password:
 *   post:
 *     summary: Reset a user's password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identity:
 *                 type: string
 *               salt:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid request
 */
authRouter.post('/reset-password', resetPassValidation, resetPassword)

/**
 * @swagger
 * /v1/auth/forgot-password:
 *   post:
 *     summary: Send a password reset link to the user's email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset password link sent successfully
 *       404:
 *         description: Email not registered
 */
authRouter.post('/forgot-password', forgotPassValidation, forgotPassword)

/**
 * @swagger
 * /v1/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               preferred_subscription_plan_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Email already exists
 */
authRouter.post('/signup', signupValidation, signup)

/**
 * @swagger
 * /v1/auth/profile-update:
 *   post:
 *     summary: Update the user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               address:
 *                 type: string
 *               phone_no:
 *                 type: string
 *               organization_name:
 *                 type: string
 *               organization_website:
 *                 type: string
 *               abn_no:
 *                 type: string
 *               profile_image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
authRouter.post(
  '/profile-update',
  commonHelper.imageUpload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'organization_logo', maxCount: 1 },
  ]),
  protect,
  updateProfileValidation,
  updateProfile
)

/**
 * @swagger
 * /v1/auth/profile-view:
 *   get:
 *     summary: View the user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 */
authRouter.get('/profile-view', protect, viewProfile)

/**
 * @swagger
 * /v1/auth/change-password:
 *   post:
 *     summary: Change the user's password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               old_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Incorrect old password
 */
authRouter.post(
  '/change-password',
  protect,
  changePassValidation,
  changePassword
)

authRouter.post('/refresh', refreshTokenValidation)

/**
 * @swagger
 * /v1/auth/verify:
 *   post:
 *     summary: Verify the access token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access token is valid
 *       401:
 *         description: Invalid or expired access token
 */
authRouter.post('/verify', accessTokenValidation)

export default authRouter
