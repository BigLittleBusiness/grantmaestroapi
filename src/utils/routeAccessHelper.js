import CommonHelper from './commonHelper.js'
//need to define the user role access on every route patha key
const routePathAccessUserTypes = {
  dashboard: [1, 2, 3, 4],
  'change-password': [1, 2, 3],
  'member-add': [2],
  'member-update': [2],
  'member-list': [1, 2, 3],
  'member-details': [2],
  'member-view': [1, 2],
  'member-remove': [1, 2],
  'profile-view': [1, 2, 3],
  'profile-update': [1, 2, 3],
  'grant-add': [2],
  'grant-update': [2],
  'grant-list': [1, 2, 3, 4],
  'grant-details': [2, 3, 4],
  'grant-notes-manage': [2, 3],
  'grant-report-manage': [2],
  'grant-report-remove': [2],
  'grant-expense-manage': [2],
  'grant-expense-remove': [2],
  'task-assign': [2],
  'task-list': [1, 2, 3, 4],
  'task-details': [2, 3, 4],
  'task-status-update': [2, 3],
  'task-update': [2],
  'task-remove': [2],
  'grant-task-list': [2, 3, 4],
  'ticket-list': [1, 2, 3],
  'ticket-detail': [1, 2, 3],
  'ticket-manage': [2, 3],
  'ticket-remove': [2, 3],
  'ticket-status-update': [1],
  'create-checkout-session': [1, 2, 3, 4],
  'create-subscription-plan': [1, 2, 3, 4],
  'update-subscription-expiry-date': [1],
  'manage-grant-category': [1],
  'calendar-events': [1, 2, 3, 4],
  'grant-category-list': [1, 2, 3, 4],
  'organization-list': [1],
  // Pin Payments System Admin settings
  'pin-settings': [1],
  // Subscription charge (all authenticated users) and webhook (public, no auth)
  'create-charge': [1, 2, 3, 4],
  'logout': [1, 2, 3, 4],
}

//check the user type have the access or not for this sections
export const validateRouteAccess = async (routePath = '', userType = 0) => {
  var isAccessValidate = false
  if (userType > 0 && routePath.length > 0) {
    // console.log(" userType :: ",userType)
    // console.log(" routePath :: ",routePath)
    let count = await CommonHelper.countStringOccurance(routePath, '/')
    if (count > 0) {
      const filteredRoutePath = routePath.split('/')
      routePath = filteredRoutePath[0]
    }
    if (routePathAccessUserTypes.hasOwnProperty(routePath)) {
      let allowedUserTypes = routePathAccessUserTypes[routePath]
      if (
        Array.isArray(allowedUserTypes) &&
        allowedUserTypes.indexOf(userType) != -1
      ) {
        isAccessValidate = true
      }
    } else {
      console.log('Route Path not define')
    }
  }
  return isAccessValidate
}

//export the details
