import { ROLE } from './routeAccessHelper.js'

/**
 * Access rules once an organisation's trial or paid period has ended:
 *  - the Platform Admin is never affected;
 *  - an Organisation Admin can still sign in, but only to pay (BILLING_ROUTES);
 *  - other organisation users are signed out until the admin renews.
 * Expiry dates (grant_users.subscription_expiry_date) include any renewal grace.
 */

// Route keys (first path segment, as in routeAccessHelper) usable while expired.
const BILLING_ROUTES = new Set([
  'profile-view',
  'logout',
  'change-password',
  'force-password-reset',
  'payment-provider',
  'create-checkout-session',
  'checkout-session',
  'create-charge',
  'subscription-details',
  'billing-portal',
])

export const EXPIRED_MEMBER_MESSAGE =
  "Your organisation's subscription has ended. Please contact your administrator to renew."
export const EXPIRED_ADMIN_MESSAGE =
  'Your subscription has ended. Subscribe to restore access for your team.'

export const isSubscriptionExpired = (user) => {
  if (Number(user.user_type) === ROLE.PLATFORM_SUPER_ADMIN) return false
  if (!user.subscription_expiry_date) return true
  return new Date() > new Date(user.subscription_expiry_date)
}

export const canRenewSubscription = (user) => Number(user.user_type) === ROLE.ORGANISATION_ADMIN

export const isBillingRoute = (routeKey) => BILLING_ROUTES.has(routeKey)
