import jwt from 'jsonwebtoken'
import { jwtDecode } from 'jwt-decode'
import base from '../models/base.js'
import { validateRouteAccess } from '../utils/routeAccessHelper.js'

const { User } = base

const isTokenExpired = (token) => {
  try {
    const decodedToken = jwtDecode(token)
    return decodedToken.exp < Date.now() / 1000
  } catch (_err) {
    return true
  }
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
