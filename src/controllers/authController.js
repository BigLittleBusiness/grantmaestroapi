import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import randomstring from 'randomstring'
import moment from 'moment'
import CommonHelper from '../utils/commonHelper.js'
import sendEmail from '../utils/mailHelper.js'
import { profileImageUrl } from '../utils/s3UrlHelper.js'

const { User, UserRole, Organization, MasterData, Country, SubscriptionPlans } =
  base

/**
 * @description Register a new user
 * @route POST /auth/signup
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing email, password, and subscription plan ID
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const signup = asyncHandler(async (req, res, next) => {
  const { email, password, preferred_subscription_plan_id, first_name, last_name, organization_name } = req.body
  const usr = await User.findOne({ where: { email: email } })
  if (usr) {
    return res.send({
      status: false,
      message: 'Email already exist.',
    })
  }
  // Validate the requested plan before creating organisation data, so failed
  // registrations do not leave orphaned tenant records behind.
  const planInfo = await SubscriptionPlans.findOne({
    where: { plan_id: preferred_subscription_plan_id, is_deleted: 0 },
  })
  if (!planInfo) {
    return res.send({
      status: false,
      message: 'Selected subscription plan does not exist',
    })
  }
  const orgObj = {
    organization_name: organization_name || '',
    abn_no: '',
    email,
    address: '',
    phone_no: '',
    created_at: new Date(),
    modified_at: new Date(),
  }
  const Org = await Organization.create(orgObj)

  const nextDate = new Date().setDate(
    new Date().getDate() + planInfo.trial_days
  )
  const subscriptionExpiryDate = moment(nextDate).format('YYYY-MM-DD')
  const decodedPass = atob(password)

  // Generate a 4-digit OTP for account verification
  const otpCode = randomstring.generate({ length: 4, charset: 'numeric' })

  const usrObj = {
    email,
    password: decodedPass,
    first_name: first_name || '',
    middle_name: '',
    last_name: last_name || '',
    // Public registration must always establish an organisation-level admin.
    // Platform Super Admin accounts are created only through controlled setup.
    user_type: 1,
    organization_id: Org.organization_id,
    created_at: new Date(),
    modified_at: new Date(),
    preferred_subscription_plan_id,
    subscription_expiry_date: subscriptionExpiryDate,
    account_verification_otp: otpCode,
    is_otp_verified: 0,
  }
  await User.create(usrObj)

  // Send OTP verification email
  sendEmail(
    email,
    'Verify Your Grant Maestro Account',
    'verifyAccount',
    {
      firstName: first_name || email,
      otpCode,
      year: new Date().getFullYear(),
    },
    null
  )

  res.send({
    status: true,
    message: 'Account created. Please check your email for your verification code.',
    data: { email },
  })
})

/**
 * @description Verify account OTP after signup
 * @route POST /auth/verify-otp
 * @access Public
 */
export const verifyOtp = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body
  const user = await User.findOne({ where: { email, is_deleted: 0 } })
  if (!user) {
    return res.send({ status: false, message: 'Account not found.' })
  }
  if (user.is_otp_verified) {
    return res.send({ status: false, message: 'Account already verified.' })
  }
  if (user.account_verification_otp !== otp) {
    return res.send({ status: false, message: 'Invalid verification code. Please try again.' })
  }
  await User.update(
    { is_otp_verified: 1, otp_verified_at: new Date() },
    { where: { user_id: user.user_id } }
  )

  // Auto-login: issue tokens so the user lands directly on the dashboard
  const accessToken = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '30m' })
  const refreshToken = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  await User.update(
    { refresh_token: refreshToken, is_valid_refresh_token: true },
    { where: { user_id: user.user_id } }
  )
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 7 * 24 * 60 * 60 * 1000 })
  res.cookie('accessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 30 * 60 * 1000 })

  // Send welcome email now that account is verified
  sendEmail(
    user.email,
    'Welcome to Grant Maestro',
    'welcome',
    {
      name: user.first_name || user.email,
      email: user.email,
      loginUrl: process.env.FRONTEND_URL + '/login',
      supportUrl: process.env.FRONTEND_URL + '/support',
      year: new Date().getFullYear(),
    },
    null
  )

  const userDetails = {
    user_id: user.user_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    user_type: user.user_type,
    organization_id: user.organization_id,
    preferred_subscription_plan_id: user.preferred_subscription_plan_id,
  }

  res.json({
    status: true,
    message: 'Account verified successfully. Welcome to Grant Maestro!',
    data: { userDetails },
  })
})

/**
 * @description Login a user
 * @route POST /auth/login
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing email and password
 * @param {Object} res - Express response object
 * @returns {Object} Response with user details and access token
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body
  const user = await User.findOne({
    where: {
      email: email,
      is_deleted: 0,
    },
    include: [
      {
        model: Organization,
        as: 'organization',
        attributes: [
          'organization_id',
          'organization_name',
          'organization_website',
          'abn_no',
        ],
        required: true,
      },
      {
        model: MasterData,
        as: 'position',
        attributes: ['masterdata_id', 'name'],
        required: false,
      },
      {
        model: UserRole,
        as: 'user_role',
        attributes: ['role_id', 'name'],
        required: false,
      },
    ],
  })
  if (!user) {
    return res.send({
      status: false,
      message: 'user does not exist',
    })
  }
  const decodedPass = atob(password)
  var passwordIsValid = bcrypt.compareSync(decodedPass, user.password)
  if (!passwordIsValid) {
    return res.send({
      status: false,
      message: 'Incorrect Password',
    })
  }
  // var token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
  //   expiresIn: 8640000, // 1/2 hours
  // })
  // const refreshToken = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
  //   expiresIn: '24h', // 24 hours
  // })
  let subscriptionStatus = true
  const subExpDate = user.subscription_expiry_date
  if (new Date() > new Date(subExpDate)) {
    subscriptionStatus = false
  }
  if (subscriptionStatus === false && user.user_type !== 2) {
    return res.send({
      status: false,
      message:
        'your subscription has expired, please contact your administrator',
    })
  }
  //update user details
  // await User.update(
  //   {
  //     // token: token,
  //     // refresh_token: refreshToken,
  //     is_valid_refresh_token: true,
  //     subscription_status: subscriptionStatus,
  //   },
  //   {
  //     where: {
  //       user_id: user.user_id,
  //     },
  //   }
  // )
  let userDetails = {}
  userDetails.user_id = user.user_id
  userDetails.first_name = user.first_name
  userDetails.middle_name = user.middle_name
  userDetails.last_name = user.last_name
  userDetails.email = user.email
  userDetails.phone_no = user.phone_no
  userDetails.address = user.address
  userDetails.state = user.state
  userDetails.user_type = user.user_type.role_id
  userDetails.organization_id = user.organization.organization_id
  userDetails.organization_name = user.organization.organization_name
  userDetails.abn_no = user.organization.abn_no
  userDetails.organization_website = user.organization.organization_website
  userDetails.position_id = user.position ? user.position.masterdata_id : 0
  userDetails.position = user.position ? user.position.name : ''
  userDetails.profile_image = profileImageUrl(user.profile_image)
  userDetails.user_role_id = user.user_role ? user.user_role.role_id : ''
  userDetails.user_role = user.user_role ? user.user_role.name : ''
  userDetails.preferred_subscription_plan_id =
    user.preferred_subscription_plan_id
      ? user.preferred_subscription_plan_id
      : ''
  userDetails.subscription_status = subscriptionStatus
  userDetails.requires_password_reset = user.requires_password_reset || 0
  const accessToken = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
    expiresIn: '30m',
  })
  const refreshToken = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })

  // Persist the refresh token in the database so it can be validated and
  // invalidated server-side (prevents token reuse after logout or rotation).
  await User.update(
    {
      refresh_token: refreshToken,
      is_valid_refresh_token: true,
    },
    { where: { user_id: user.user_id } }
  )

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 30 * 60 * 1000,
  })
  res.json({
    success: true,
    data: { userDetails },
    message: 'Logged in successfully',
  })
})

/**
 * @description Generate a new access token using a refresh token
 * @route GET /auth/refresh-token
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with a new access token
 */
export const generateAccessToken = asyncHandler(async (req, res, next) => {
  const cookies = req.cookies
  if (!cookies?.jwt)
    return res.status(401).json({
      success: false,
      message: 'Refresh token does not exist',
    })
  const refreshToken = cookies.jwt
  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)
  const user = await User.findOne({
    where: { user_id: decoded.id, refresh_token: refreshToken },
  })
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    })
  }
  if (user.is_valid_refresh_token === false) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    })
  }
  const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
    expiresIn: 1800, // 1/2 hours
  })

  //update user details
  await User.update(
    {
      token: token,
    },
    {
      where: {
        user_id: user.user_id,
      },
    }
  )
  res.status(200).json({
    success: true,
    data: { token },
    message: 'Access token generated successfully',
  })
})

/**
 * @description Send a password reset link to the user's email
 * @route POST /auth/forgot-password
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing email
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body
  let user = await User.findOne({
    where: { email: email, is_deleted: 0 },
  })
  // Always acknowledge the request in the same way so this endpoint cannot
  // be used to discover which email addresses have GrantMaestro accounts.
  if (!user) {
    return res.status(200).json({
      status: true,
      message: 'If an account exists for this email address, password reset instructions will be sent shortly.',
      data: {},
    })
  }
  const currentDate = moment(new Date()).format('YYYY-MM-DD')
  if (
    user.reset_password_attempted_on == currentDate &&
    user.reset_password_attempted >= 3
  ) {
    return res.send({
      status: false,
      message: 'Max number of attempt has been exceeded.',
    })
  }
  const OTP = await randomstring.generate({
    length: 6,
    charset: 'numeric',
    capitalization: 'uppercase',
  })
  const frontendSiteUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/'
  const uid = CommonHelper.encrypt(email)
  const salt = CommonHelper.encrypt(OTP)
  const url = frontendSiteUrl + 'reset-password?uid=' + uid + '&code=' + salt
  //console.log(url)
  var noAttempted = 1
  if (user.reset_password_attempted_on == currentDate) {
    noAttempted = parseInt(user.reset_password_attempted + 1)
  }
  await User.update(
    {
      reset_password_otp: OTP,
      reset_password_attempted: noAttempted,
      reset_password_attempted_on: currentDate,
    },
    {
      where: {
        user_id: user.user_id,
      },
    }
  )
  sendEmail(
    email,
    'Reset Your Password — Grant Maestro',
    'passwordReset',
    {
      resetUrl: url,
      name: user.first_name ? user.first_name : '',
      email: email,
      loginUrl: process.env.FRONTEND_URL + '/login',
      supportUrl: process.env.FRONTEND_URL + '/support',
      year: new Date().getFullYear(),
    },
    null
  )

  res.status(200).json({
    status: true,
    message: 'If an account exists for this email address, password reset instructions will be sent shortly.',
    data: {},
  })
})

/**
 * @description Reset a user's password
 * @route POST /auth/reset-password
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing identity, salt, and new password
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const resetPassword = asyncHandler(async (req, res, next) => {
  const { identity, salt, password } = req.body
  let email = CommonHelper.decrypt(identity)
  let code = CommonHelper.decrypt(salt)
  const user = await User.findOne({
    where: { email: email, reset_password_otp: code },
    attributes: ['user_id', 'first_name', 'email', 'phone_no'],
  })
  if (!user) {
    return res.send({
      status: false,
      message: 'invalid link',
    })
  }
  const decodedPass = atob(password)
  await User.update(
    {
      reset_password_otp: '',
      reset_password_attempted: 0,
      password: bcrypt.hashSync(decodedPass, 8),
      requires_password_reset: 0,
      refresh_token: null,
      is_valid_refresh_token: false,
    },
    {
      where: {
        user_id: user.user_id,
      },
    }
  )
  //send mail

  res.send({
    status: true,
    message: 'Password updated successfully.',
    data: {},
  })
})

/**
 * @description Set a personal password for an invited user before first access
 * @route POST /auth/force-password-reset
 * @access Private
 */
export const forcePasswordReset = asyncHandler(async (req, res) => {
  if (!req.user.requires_password_reset) {
    return res.status(409).json({
      status: false,
      message: 'A forced password reset is not required for this account.',
    })
  }

  const { new_password } = req.body
  let decodedNewPassword
  try {
    decodedNewPassword = atob(new_password)
  } catch (_error) {
    return res.status(422).json({ status: false, message: 'Invalid password payload.' })
  }
  if (decodedNewPassword.length < 8) {
    return res.status(422).json({
      status: false,
      message: 'Password must be at least 8 characters long.',
    })
  }

  await User.update(
    {
      password: bcrypt.hashSync(decodedNewPassword, 8),
      requires_password_reset: 0,
      refresh_token: null,
      is_valid_refresh_token: false,
      modified_at: new Date(),
    },
    { where: { user_id: req.user.user_id } }
  )

  res.clearCookie('accessToken', { httpOnly: true, secure: true, sameSite: 'None' })
  res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'None' })
  return res.status(200).json({
    status: true,
    message: 'Password set successfully. Please sign in with your new password.',
    data: {},
  })
})

/**
 * @description Change the user's password
 * @route POST /auth/change-password
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing old and new passwords
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const changePassword = asyncHandler(async (req, res, next) => {
  const userId = req.user.user_id
  const { old_password, new_password } = req.body
  const decodedOldPass = atob(old_password)

  var passwordIsValid = bcrypt.compareSync(decodedOldPass, req.user.password)
  if (!passwordIsValid) {
    return res.send({
      status: false,
      message: 'Incorrect old password.',
    })
  }
  const decodedNewPass = atob(new_password)
    await User.update(
    {
      password: bcrypt.hashSync(decodedNewPass, 8),
      is_valid_refresh_token: false,
      token: null,
      requires_password_reset: 0,
    },
    {
      where: {
        user_id: userId,
      },
    }
  )
  res.send({
    status: true,
    message:
      'Password updated successfully, please login again with new password.',
    data: {},
  })
})

/**
 * @description View the user's profile
 * @route GET /auth/profile-view
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with user profile details
 */
export const viewProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user.user_id
  const organizationId = req.user.organization_id
  const userInfo = await User.findOne({
    attributes: [
      'user_id',
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'phone_no',
      'address',
      'state_id',
      'country_id',
      'profile_image',
      'has_profile_updated',
      'position_text',
    ],
    where: { is_deleted: 0, organization_id: organizationId, user_id: userId },
    include: [
      {
        model: Organization,
        as: 'organization',
        attributes: [
          'organization_id',
          'organization_name',
          'organization_website',
          'abn_no',
        ],
        required: true,
      },
      {
        model: Country,
        as: 'country',
        attributes: ['country_id', 'country_name'],
        required: false,
      },
      {
        model: MasterData,
        as: 'position',
        attributes: ['masterdata_id', 'name'],
        required: false,
      },
      {
        model: UserRole,
        as: 'user_role',
        attributes: ['role_id', 'name'],
        required: false,
      },
    ],
    required: false,
  })
  let userDetails = {}
  userDetails.user_id = userInfo.user_id
  userDetails.email = userInfo.email
  userDetails.organization_id = userInfo.organization.organization_id
  userDetails.organization_name = userInfo.organization.organization_name
  userDetails.abn_no = userInfo.organization.abn_no
  userDetails.organization_website = userInfo.organization.organization_website
  userDetails.first_name = userInfo.first_name
  userDetails.middle_name = userInfo.middle_name
  userDetails.last_name = userInfo.last_name
  userDetails.address = userInfo.address
  userDetails.phone_no = userInfo.phone_no
  userDetails.position_text = userInfo.position_text
  userDetails.position_id = userInfo.position
    ? userInfo.position.masterdata_id
    : ''
  userDetails.position_name = userInfo.position ? userInfo.position.name : ''
  userDetails.country_id = userInfo.country ? userInfo.country.country_id : ''
  userDetails.country_name = userInfo.country
    ? userInfo.country.country_name
    : ''
  userDetails.profile_image = profileImageUrl(userInfo.profile_image)
  userDetails.has_profile_updated = userInfo.has_profile_updated
  userDetails.user_role_id = userInfo.user_role
    ? userInfo.user_role.role_id
    : ''
  userDetails.user_role = userInfo.user_role ? userInfo.user_role.name : ''
  res.send({
    success: true,
    message: 'Profile information',
    data: { userDetails },
  })
})

/**
 * @description Update the user's profile
 * @route POST /auth/profile-update
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing profile details
 * @param {Object} res - Express response object
 * @returns {Object} Response with updated user profile details
 */
export const updateProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user.user_id
  const {
    first_name,
    last_name,
    address,
    phone_no,
    organization_name,
    organization_website,
    abn_no,
  } = req.body

  const usrObj = {
    first_name,
    middle_name: '',
    last_name,
    phone_no,
    address,
    modified_at: new Date(),
  }
  if (req.files && req.files.profile_image) {
    usrObj.profile_image = req.files.profile_image[0].filename
  } else {
    usrObj.profile_image = usrObj.profile_image
  }
  if (req.user.has_profile_updated === false) {
    usrObj.has_profile_updated = true
  }
  await User.update(usrObj, { where: { user_id: userId } })
  //update organization information
  const organizationId = req.user.organization_id
  const orgObj = {
    organization_name,
    organization_website,
    abn_no,
  }
  await Organization.update(orgObj, {
    where: { organization_id: organizationId },
  })
  //get updated user information
  const userInfo = await User.findOne({
    attributes: [
      'user_id',
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'profile_image',
      'phone_no',
      'address',
      'state_id',
      'country_id',
      'has_profile_updated',
      'user_type',
    ],
    where: { is_deleted: 0, user_id: userId },
    include: [
      {
        model: Organization,
        as: 'organization',
        attributes: [
          'organization_id',
          'organization_name',
          'organization_website',
          'abn_no',
        ],
        required: true,
      },
      {
        model: Country,
        as: 'country',
        attributes: ['country_id', 'country_name'],
        required: false,
      },
      {
        model: MasterData,
        as: 'position',
        attributes: ['masterdata_id', 'name'],
        required: false,
      },
    ],
    required: false,
  })
  let userDetails = {}
  userDetails.user_id = userInfo.user_id
  userDetails.email = userInfo.email
  userDetails.user_role_id = userInfo.user_type
  userDetails.organization_id = userInfo.organization.organization_id
  userDetails.organization_name = userInfo.organization.organization_name
  userDetails.organization_website = userInfo.organization.organization_website
  userDetails.abn_no = userInfo.organization.abn_no
  userDetails.first_name = userInfo.first_name
  userDetails.middle_name = userInfo.middle_name
  userDetails.last_name = userInfo.last_name
  userDetails.address = userInfo.address
  userDetails.phone_no = userInfo.phone_no
  userDetails.position_id = userInfo.position
    ? userInfo.position.masterdata_id
    : ''
  userDetails.position_name = userInfo.position ? userInfo.position.name : ''
  userDetails.country_id = userInfo.country ? userInfo.country.country_id : 0
  userDetails.country_name = userInfo.country
    ? userInfo.country.country_name
    : ''
  userDetails.profile_image = profileImageUrl(userInfo.profile_image)
  userDetails.has_profile_updated = userInfo.has_profile_updated
  res.send({
    success: true,
    message: 'Profile updated successfully.',
    data: { userDetails },
  })
})

/**
 * @description Update the subscription expiry date
 * @route POST /auth/update-subscription-expiry-date
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const subscriptionExpiryDate = asyncHandler(async (req, res) => {
  res.send({
    status: true,
    message: 'Subscription expiry date updated successfully.',
    data: {},
  })
})

/**
 * @description Logout the user
 * @route POST /auth/logout
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const logout = asyncHandler(async (req, res) => {
  // Invalidate the server-side session flag for the authenticated account. The
  // auth middleware checks this flag on every protected request, so an access
  // token captured before logout cannot continue to call the API.
  await User.update(
    { refresh_token: null, is_valid_refresh_token: false },
    { where: { user_id: req.user.user_id } }
  )

  res.clearCookie('accessToken', { httpOnly: true, secure: true, sameSite: 'None' })
  res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'None' })
  res.json({ success: true, message: 'Logged out successfully' })
})

export const refreshTokenValidation = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken
  if (!refreshToken) return res.status(401).json({ message: 'Unauthorized' })

  try {
    // Verify the JWT signature and expiry first.
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)

    // Validate the token against the database to prevent reuse after logout
    // or after a token rotation has occurred.
    const user = await User.findOne({
      where: {
        user_id: decoded.id,
        refresh_token: refreshToken,
        is_valid_refresh_token: true,
        is_deleted: 0,
      },
    })
    if (!user) {
      return res.status(403).json({ message: 'Invalid or revoked refresh token' })
    }

    // Issue a new access token carrying the same user id used throughout the app.
    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    )

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 30 * 60 * 1000,
    })
    res.json({ success: true, message: 'Access token refreshed successfully' })
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired refresh token' })
  }
})

export const accessTokenValidation = asyncHandler(async (req, res) => {
  const accessToken = req.cookies.accessToken
  if (!accessToken)
    return res
      .status(401)
      .json({ authenticated: false, message: 'Unauthorized' })

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET)
    res.json({ authenticated: true, user: decoded }) // ✅ Return authenticated state
  } catch (error) {
    res
      .status(403)
      .json({ authenticated: false, message: 'Invalid or expired token' })
  }
})
