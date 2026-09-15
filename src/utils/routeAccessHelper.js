// Canonical GrantMaestro role policy.
// 1 = Organisation Admin, 2 = Platform Super Admin,
// 3 = Team Member, 4 = Acquittal Contributor.
export const ROLE = Object.freeze({
  ORGANISATION_ADMIN: 1,
  PLATFORM_SUPER_ADMIN: 2,
  TEAM_MEMBER: 3,
  ACQUITTAL_CONTRIBUTOR: 4,
})

const organisationUsers = [
  ROLE.ORGANISATION_ADMIN,
  ROLE.TEAM_MEMBER,
  ROLE.ACQUITTAL_CONTRIBUTOR,
]
const organisationAdministrators = [ROLE.ORGANISATION_ADMIN]
const platformAdministrators = [ROLE.PLATFORM_SUPER_ADMIN]
const allAuthenticatedUsers = [...organisationUsers, ROLE.PLATFORM_SUPER_ADMIN]

// The first path component after each route prefix is used by auth middleware.
// Keep this list explicit: an unlisted protected route fails closed.
const routePathAccessUserTypes = {
  dashboard: organisationUsers,
  'change-password': allAuthenticatedUsers,
  'force-password-reset': allAuthenticatedUsers,
  'member-add': organisationAdministrators,
  'member-update': organisationAdministrators,
  'member-list': organisationAdministrators,
  'member-details': organisationAdministrators,
  'member-view': organisationAdministrators,
  'member-remove': organisationAdministrators,
  'profile-view': allAuthenticatedUsers,
  'profile-update': allAuthenticatedUsers,
  'grant-add': organisationAdministrators,
  'grant-update': organisationAdministrators,
  'grant-list': organisationUsers,
  'grant-details': organisationUsers,
  'grant-notes-manage': organisationUsers,
  'grant-report-manage': organisationUsers,
  'grant-report-remove': organisationAdministrators,
  'grant-expense-manage': organisationUsers,
  'grant-expense-remove': organisationAdministrators,
  'task-assign': organisationAdministrators,
  'task-list': organisationUsers,
  'task-details': organisationUsers,
  'task-status-update': organisationUsers,
  'task-update': organisationAdministrators,
  'task-remove': organisationAdministrators,
  'grant-task-list': organisationUsers,
  'ticket-list': organisationUsers,
  'ticket-detail': organisationUsers,
  'ticket-manage': organisationUsers,
  'ticket-remove': organisationUsers,
  'ticket-status-update': platformAdministrators,
  'payment-provider': organisationAdministrators,
  'create-checkout-session': organisationAdministrators,
  'create-charge': organisationAdministrators,
  'manage-grant-category': platformAdministrators,
  'grant-category-list': organisationUsers,
  'calendar-events': organisationUsers,
  'organization-list': platformAdministrators,
  suitability: organisationUsers,
  'task-description': organisationUsers,
  'draft-note': organisationUsers,
  logout: allAuthenticatedUsers,

  // Platform configuration and subscription administration.
  'pin-settings': platformAdministrators,
  'stripe-settings': platformAdministrators,
  'email-settings': platformAdministrators,
  'platform-stats': platformAdministrators,
  plans: platformAdministrators,
  'promo-codes': platformAdministrators,
}

export const validateRouteAccess = (routePath = '', userType = 0) => {
  if (!userType || !routePath) return false
  const key = routePath.split('/')[0]
  const allowedUserTypes = routePathAccessUserTypes[key]
  return Array.isArray(allowedUserTypes) && allowedUserTypes.includes(Number(userType))
}

export default routePathAccessUserTypes
