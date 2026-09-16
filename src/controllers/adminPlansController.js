/**
 * adminPlansController.js
 *
 * System Admin CRUD for subscription plans and promo codes.
 * All routes require authentication + Super Admin (user_role_id = 2).
 */

import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import { Op } from 'sequelize'
const { SubscriptionPlans, PromoCode } = base

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PLANS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /v1/admin/plans
 * Fetch all active subscription plans.
 */
export const listPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlans.findAll({
    where: { is_deleted: 0 },
    order: [['plan_id', 'ASC']],
  })
  return res.json({ status: true, data: plans })
})

/**
 * PUT /v1/admin/plans/:plan_id
 * Update an existing subscription plan.
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const { plan_id } = req.params
  const {
    plan_name,
    plan_description,
    plan_price,
    annual_price,
    overage_rate,
    seat_allowance,
    admin_seats,
    team_seats,
    trial_days,
  } = req.body

  const plan = await SubscriptionPlans.findOne({
    where: { plan_id, is_deleted: 0 },
  })
  if (!plan) {
    return res.status(404).json({ status: false, message: 'Plan not found.' })
  }

  await plan.update({
    plan_name:        plan_name        ?? plan.plan_name,
    plan_description: plan_description ?? plan.plan_description,
    plan_price:       plan_price       ?? plan.plan_price,
    annual_price:     annual_price     ?? plan.annual_price,
    overage_rate:     overage_rate     ?? plan.overage_rate,
    seat_allowance:   seat_allowance   ?? plan.seat_allowance,
    admin_seats:      admin_seats      ?? plan.admin_seats,
    team_seats:       team_seats       ?? plan.team_seats,
    trial_days:       trial_days       ?? plan.trial_days,
    modified_at:      new Date(),
  })

  return res.json({ status: true, message: 'Plan updated successfully.', data: plan })
})

// ─────────────────────────────────────────────────────────────────────────────
// PROMO CODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /v1/admin/promo-codes
 * Fetch all active promo codes.
 */
export const listPromoCodes = asyncHandler(async (req, res) => {
  const codes = await PromoCode.findAll({
    where: { is_deleted: 0 },
    order: [['created_at', 'DESC']],
  })
  return res.json({ status: true, data: codes })
})

/**
 * POST /v1/admin/promo-codes
 * Create a new promo code.
 */
export const createPromoCode = asyncHandler(async (req, res) => {
  const { code, discount_type, discount_value, duration_months, expires_at } = req.body

  if (!code || !discount_type || discount_value === undefined) {
    return res.status(400).json({
      status: false,
      message: 'code, discount_type, and discount_value are required.',
    })
  }

  if (!['percentage', 'fixed'].includes(discount_type)) {
    return res.status(400).json({
      status: false,
      message: "discount_type must be 'percentage' or 'fixed'.",
    })
  }

  if (discount_type === 'percentage' && (discount_value <= 0 || discount_value > 100)) {
    return res.status(400).json({
      status: false,
      message: 'Percentage discount must be between 1 and 100.',
    })
  }

  if (discount_type === 'fixed' && discount_value <= 0) {
    return res.status(400).json({
      status: false,
      message: 'Fixed discount must be greater than 0.',
    })
  }

  // Check for duplicate code (case-insensitive)
  const existing = await PromoCode.findOne({
    where: { code: code.toUpperCase(), is_deleted: 0 },
  })
  if (existing) {
    return res.status(409).json({ status: false, message: 'A promo code with that name already exists.' })
  }

  const promo = await PromoCode.create({
    code:            code.toUpperCase(),
    discount_type,
    discount_value,
    duration_months: duration_months || 1,
    expires_at:      expires_at || null,
    created_at:      new Date(),
    modified_at:     new Date(),
  })

  return res.status(201).json({ status: true, message: 'Promo code created.', data: promo })
})

/**
 * DELETE /v1/admin/promo-codes/:promo_id
 * Soft-delete a promo code.
 */
export const deletePromoCode = asyncHandler(async (req, res) => {
  const { promo_id } = req.params
  const promo = await PromoCode.findOne({ where: { promo_id, is_deleted: 0 } })
  if (!promo) {
    return res.status(404).json({ status: false, message: 'Promo code not found.' })
  }
  await promo.update({ is_deleted: 1, modified_at: new Date() })
  return res.json({ status: true, message: 'Promo code deleted.' })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Validate a promo code (used at registration & checkout)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /v1/subscription/validate-promo
 * Validate a promo code and return its discount details.
 * Public endpoint — no auth required.
 */
export const validatePromoCode = asyncHandler(async (req, res) => {
  const { code } = req.body
  if (!code) {
    return res.status(400).json({ status: false, message: 'code is required.' })
  }

  const promo = await PromoCode.findOne({
    where: { code: code.toUpperCase(), is_deleted: 0 },
  })

  if (!promo) {
    return res.status(404).json({ status: false, message: 'Invalid promo code.' })
  }

  // Check expiry
  if (promo.expires_at) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(promo.expires_at)
    if (expiry < today) {
      return res.status(410).json({ status: false, message: 'This promo code has expired.' })
    }
  }

  return res.json({
    status: true,
    message: 'Promo code is valid.',
    data: {
      promo_id:        promo.promo_id,
      code:            promo.code,
      discount_type:   promo.discount_type,
      discount_value:  promo.discount_value,
      duration_months: promo.duration_months,
      expires_at:      promo.expires_at,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM STATS (Sys Admin Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /v1/admin/platform-stats
 * Returns platform-wide metrics for the Sys Admin dashboard.
 */
export const getPlatformStats = asyncHandler(async (req, res) => {
  const { User, Organization, Grant, Task, SystemSettings } = base

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [
    totalOrganisations,
    activeSubscriptions,
    expiredSubscriptions,
    totalUsers,
    totalGrants,
    totalTasks,
    newOrgsLast30Days,
    recentOrgs,
    settings,
  ] = await Promise.all([
    Organization.count({ where: { is_deleted: 0, organization_name: { [Op.ne]: 'GrantMaestro Platform' } } }),
    User.count({
      where: {
        user_type: 1,
        is_deleted: 0,
        subscription_expiry_date: { [Op.gte]: today },
      },
    }).catch(() => 0),
    User.count({
      where: {
        user_type: 1,
        is_deleted: 0,
        subscription_expiry_date: { [Op.lt]: today },
      },
    }).catch(() => 0),
    User.count({ where: { is_deleted: 0 } }),
    Grant.count({ where: { is_deleted: 0 } }),
    Task.count({ where: { is_deleted: 0 } }),
    Organization.count({
      where: {
        is_deleted: 0,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
    }).catch(() => 0),
    Organization.findAll({
      where: { is_deleted: 0, organization_name: { [Op.ne]: 'GrantMaestro Platform' } },
      attributes: ['organization_id', 'organization_name', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 10,
    }),
    SystemSettings.findAll({
      attributes: ['setting_key', 'setting_value'],
      where: { is_deleted: 0, is_blocked: 0 },
    }),
  ])

  const configuredKeys = new Set(settings.filter((setting) => String(setting.setting_value || '').trim()).map((setting) => setting.setting_key))
  const integrationStatus = {
    email: configuredKeys.has('ses_access_key_id') && configuredKeys.has('ses_secret_access_key') && configuredKeys.has('ses_from_email') ? 'configured' : 'needs_setup',
    storage: process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? 'configured' : 'needs_setup',
    payment: configuredKeys.has('stripe_active') && configuredKeys.has('stripe_secret_key') ? 'stripe_active' : configuredKeys.has('pin_secret_key') ? 'pin_configured' : 'needs_setup',
    ai: process.env.OPENAI_API_KEY ? 'configured' : 'needs_setup',
    scheduled_notifications: configuredKeys.has('ses_access_key_id') && configuredKeys.has('ses_secret_access_key') && configuredKeys.has('ses_from_email') ? 'ready_when_data_due' : 'blocked_by_email',
  }

  res.json({
    success: true,
    data: {
      totalOrganisations,
      activeSubscriptions,
      expiredSubscriptions,
      totalUsers,
      totalGrants,
      totalTasks,
      newOrgsLast30Days,
      recentOrgs,
      integrationStatus,
    },
  })
})
