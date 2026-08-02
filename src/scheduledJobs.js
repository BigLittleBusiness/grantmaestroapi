/**
 * scheduledJobs.js
 * Runs daily cron jobs to send proactive notifications:
 *  - Grant closing deadline warnings (7 days and 1 day before closing_date)
 *  - Subscription expiry warnings (14 days and 3 days before expiry)
 *  - Acquittal reminders (30 days and 7 days before acquittal_date)
 */
import cron from 'node-cron'
import { Op } from 'sequelize'
import base from './models/base.js'
import sendEmail from './utils/mailHelper.js'

const { User, Grant, Organization } = base

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// ─── Grant Deadline Warnings ─────────────────────────────────────────────────
// Runs at 08:00 AEST (22:00 UTC previous day) every day
cron.schedule('0 22 * * *', async () => {
  try {
    const today = new Date()
    const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7)
    const in1Day  = new Date(today); in1Day.setDate(today.getDate() + 1)

    const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

    for (const daysAhead of [7, 1]) {
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + daysAhead)
      const dateStr = targetDate.toISOString().split('T')[0]

      const grants = await Grant.findAll({
        where: {
          closing_date: dateStr,
          is_deleted: 0,
        },
        include: [{ model: Organization, as: 'organization', attributes: ['organization_id'] }],
      })

      for (const grant of grants) {
        const orgId = grant.organization_id
        const admins = await User.findAll({
          where: { organization_id: orgId, user_type: [2], is_deleted: 0 },
          attributes: ['email', 'first_name'],
        })
        for (const admin of admins) {
          sendEmail(
            admin.email,
            `Grant Deadline in ${daysAhead} Day${daysAhead > 1 ? 's' : ''} — Grant Maestro`,
            'grantDeadline',
            {
              name: admin.first_name || 'there',
              grantTitle: grant.grant_title,
              fundOriginator: grant.fund_originator,
              closingDate: formatDate(grant.closing_date),
              daysRemaining: daysAhead,
              urgency: daysAhead === 1 ? 'URGENT: ' : '',
              grantUrl: FRONTEND_URL + '/grants/' + grant.organization_grant_id,
              loginUrl: FRONTEND_URL + '/login',
              recipientEmail: admin.email,
              year: new Date().getFullYear(),
            },
            null
          )
        }
      }
    }
    console.log('[scheduledJobs] Grant deadline warnings sent')
  } catch (err) {
    console.error('[scheduledJobs] Grant deadline error:', err.message)
  }
})

// ─── Subscription Expiry Warnings ────────────────────────────────────────────
// Runs at 08:00 AEST every day
cron.schedule('0 22 * * *', async () => {
  try {
    const today = new Date()
    const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

    for (const daysAhead of [14, 3]) {
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + daysAhead)
      const dateStr = targetDate.toISOString().split('T')[0]

      const users = await User.findAll({
        where: {
          subscription_expiry_date: dateStr,
          user_type: 2,
          is_deleted: 0,
        },
        attributes: ['email', 'first_name', 'subscription_expiry_date'],
      })

      for (const user of users) {
        sendEmail(
          user.email,
          `Your Subscription Expires in ${daysAhead} Day${daysAhead > 1 ? 's' : ''} — Grant Maestro`,
          'subscriptionExpiry',
          {
            name: user.first_name || 'there',
            expiryDate: formatDate(user.subscription_expiry_date),
            daysRemaining: daysAhead,
            renewUrl: FRONTEND_URL + '/settings/subscription',
            loginUrl: FRONTEND_URL + '/login',
            supportUrl: FRONTEND_URL + '/support',
            recipientEmail: user.email,
            year: new Date().getFullYear(),
          },
          null
        )
      }
    }
    console.log('[scheduledJobs] Subscription expiry warnings sent')
  } catch (err) {
    console.error('[scheduledJobs] Subscription expiry error:', err.message)
  }
})

// ─── Acquittal Reminders ─────────────────────────────────────────────────────
// Runs at 08:00 AEST every day
cron.schedule('0 22 * * *', async () => {
  try {
    const today = new Date()
    const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

    for (const daysAhead of [30, 7]) {
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + daysAhead)
      const dateStr = targetDate.toISOString().split('T')[0]

      const grants = await Grant.findAll({
        where: {
          acquittal_date: dateStr,
          is_deleted: 0,
        },
      })

      for (const grant of grants) {
        const orgId = grant.organization_id
        const admins = await User.findAll({
          where: { organization_id: orgId, user_type: [2], is_deleted: 0 },
          attributes: ['email', 'first_name'],
        })
        for (const admin of admins) {
          sendEmail(
            admin.email,
            `Acquittal Due in ${daysAhead} Day${daysAhead > 1 ? 's' : ''} — Grant Maestro`,
            'acquittalReminder',
            {
              name: admin.first_name || 'there',
              grantTitle: grant.grant_title,
              fundOriginator: grant.fund_originator,
              acquittalDate: formatDate(grant.acquittal_date),
              wonAmount: grant.won_fund_amount
                ? `$${Number(grant.won_fund_amount).toLocaleString('en-AU')}`
                : 'N/A',
              daysRemaining: daysAhead,
              grantUrl: FRONTEND_URL + '/grants/' + grant.organization_grant_id,
              loginUrl: FRONTEND_URL + '/login',
              supportUrl: FRONTEND_URL + '/support',
              recipientEmail: admin.email,
              year: new Date().getFullYear(),
            },
            null
          )
        }
      }
    }
    console.log('[scheduledJobs] Acquittal reminders sent')
  } catch (err) {
    console.error('[scheduledJobs] Acquittal reminder error:', err.message)
  }
})

console.log('[scheduledJobs] Daily notification jobs registered (08:00 AEST)')
