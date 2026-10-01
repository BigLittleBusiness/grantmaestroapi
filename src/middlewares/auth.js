import jwt from 'jsonwebtoken'
import { jwtDecode } from 'jwt-decode'
import base from '../models/base.js'
import { validateRouteAccess } from '../utils/routeAccessHelper.js'
import {
  EXPIRED_ADMIN_MESSAGE,
  EXPIRED_MEMBER_MESSAGE,
  canRenewSubscription,
  isBillingRoute,
  isSubscriptionExpired,
} from '../utils/subscriptionAccess.js'

const { User } = base

const isTokenExpired = (token) => {
  try {
    const decodedToken = jwtDecode(token)
    return decodedToken.exp < Date.now() / 1000
  } catch (_err) {
    return true
  }
}

const clearSessionCookies = (res) => {
  res.clearCookie('accessToken', { httpOnly: true, secure: true, sameSite: 'None' })
  res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'None' })
}

const protect = async (req, res, next) => {
  const accessPath = req.path.replace(/^\//, '')
  const token = req.cookies?.accessToken

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication is required.' })
  }

  try {
    if (isTokenExpired(token)) {
      return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findOne({
      where: {
        user_id: decoded.id,
        is_deleted: 0,
        is_valid_refresh_token: true,
      },
    })

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed.' })
    }

    if (!validateRouteAccess(accessPath, user.user_type)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' })
    }

    if (isSubscriptionExpired(user)) {
      if (!canRenewSubscription(user)) {
        clearSessionCookies(res)
        return res.status(401).json({ success: false, code: 'SUBSCRIPTION_EXPIRED', message: EXPIRED_MEMBER_MESSAGE })
      }
      // The Organisation Admin keeps a session so they can pay; nothing else.
      if (!isBillingRoute(accessPath.split('/')[0])) {
        return res.status(402).json({ success: false, code: 'SUBSCRIPTION_EXPIRED', message: EXPIRED_ADMIN_MESSAGE })
      }
    }

    req.user = user
    return next()
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Your session is invalid or has expired. Please sign in again.' })
    }
    return next(err)
  }
}

export default protect
