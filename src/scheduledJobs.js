/**
 * Daily proactive notifications for grant deadlines, subscription expiry and acquittals.
 * All date matching is calculated in Australia/Sydney to avoid UTC and daylight-saving drift.
 */
import cron from 'node-cron'
import base from './models/base.js'
import sendEmail from './utils/mailHelper.js'

const { User, Grant } = base
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const SYDNEY_TIMEZONE = 'Australia/Sydney'

const dateInSydney = (daysAhead = 0) => {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SYDNEY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]))
  return `${value.year}-${value.month}-${value.day}`
}

const formatDate = (value) => new Date(value).toLocaleDateString('en-AU', {
  timeZone: SYDNEY_TIMEZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const findOrganisationAdmins = (organizationId) => User.findAll({
  where: { organization_id: organizationId, user_type: 1, is_deleted: 0 },
  attributes: ['email', 'first_name'],
})

export const runGrantDeadlineWarnings = async () => {
  for (const daysAhead of [7, 1]) {
    const grants = await Grant.findAll({
      where: { closing_date: dateInSydney(daysAhead), is_deleted: 0 },
    })
    for (const grant of grants) {
      const admins = await findOrganisationAdmins(grant.organization_id)
      for (const admin of admins) {
        await sendEmail(
          admin.email,
          `Grant Deadline in ${daysAhead} Day${daysAhead > 1 ? 's' : ''} — GrantMaestro`,
          'grantDeadlineWarning',
          {
            name: admin.first_name || 'there',
            grantTitle: grant.grant_title,
            fundOriginator: grant.fund_originator,
            closingDate: formatDate(grant.closing_date),
            daysRemaining: daysAhead,
            urgency: daysAhead === 1 ? 'URGENT: ' : '',
            grantUrl: `${FRONTEND_URL}/grant/details/${grant.organization_grant_id}`,
            loginUrl: `${FRONTEND_URL}/login`,
            recipientEmail: admin.email,
            year: new Date().getFullYear(),
          },
          null
        )
      }
    }
  }
  console.log('[scheduledJobs] Grant deadline warnings completed')
}

export const runSubscriptionExpiryWarnings = async () => {
  for (const daysAhead of [14, 3]) {
    const users = await User.findAll({
      where: {
        subscription_expiry_date: dateInSydney(daysAhead),
        user_type: 1,
        is_deleted: 0,
      },
      attributes: ['email', 'first_name', 'subscription_expiry_date'],
    })
    for (const user of users) {
      await sendEmail(
        user.email,
        `Your Subscription Expires in ${daysAhead} Day${daysAhead > 1 ? 's' : ''} — GrantMaestro`,
        'subscriptionExpiry',
        {
          name: user.first_name || 'there',
          expiryDate: formatDate(user.subscription_expiry_date),
          daysRemaining: daysAhead,
          renewUrl: `${FRONTEND_URL}/payment/checkout`,
          loginUrl: `${FRONTEND_URL}/login`,
          supportUrl: `${FRONTEND_URL}/support`,
          recipientEmail: user.email,
          year: new Date().getFullYear(),
        },
        null
      )
    }
  }
  console.log('[scheduledJobs] Subscription expiry warnings completed')
}

export const runAcquittalReminders = async () => {
  for (const daysAhead of [30, 7]) {
    const grants = await Grant.findAll({
      where: { acquittal_date: dateInSydney(daysAhead), is_deleted: 0 },
    })
    for (const grant of grants) {
      const admins = await findOrganisationAdmins(grant.organization_id)
      for (const admin of admins) {
        await sendEmail(
          admin.email,
          `Acquittal Due in ${daysAhead} Day${daysAhead > 1 ? 's' : ''} — GrantMaestro`,
          'acquittalReminder',
          {
            name: admin.first_name || 'there',
            grantTitle: grant.grant_title,
            fundOriginator: grant.fund_originator,
            acquittalDate: formatDate(grant.acquittal_date),
            wonAmount: grant.won_fund_amount ? `$${Number(grant.won_fund_amount).toLocaleString('en-AU')}` : 'N/A',
            daysRemaining: daysAhead,
            grantUrl: `${FRONTEND_URL}/grant/details/${grant.organization_grant_id}`,
            loginUrl: `${FRONTEND_URL}/login`,
            supportUrl: `${FRONTEND_URL}/support`,
            recipientEmail: admin.email,
            year: new Date().getFullYear(),
          },
          null
        )
      }
    }
  }
  console.log('[scheduledJobs] Acquittal reminders completed')
}

const safelyRun = (name, job) => async () => {
  try {
    await job()
  } catch (error) {
    console.error(`[scheduledJobs] ${name} failed:`, error.message)
  }
}

cron.schedule('0 8 * * *', safelyRun('Grant deadline warnings', runGrantDeadlineWarnings), { timezone: SYDNEY_TIMEZONE })
cron.schedule('0 8 * * *', safelyRun('Subscription expiry warnings', runSubscriptionExpiryWarnings), { timezone: SYDNEY_TIMEZONE })
cron.schedule('0 8 * * *', safelyRun('Acquittal reminders', runAcquittalReminders), { timezone: SYDNEY_TIMEZONE })

console.log('[scheduledJobs] Daily notification jobs registered (08:00 Australia/Sydney)')
