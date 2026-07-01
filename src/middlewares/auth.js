import jwt from 'jsonwebtoken'
import { jwtDecode } from 'jwt-decode'
import base from '../models/base.js'
const { User } = base
import { validateRouteAccess } from '../utils/routeAccessHelper.js'

const isTokenExpired = (token) => {
  try {
    const decodedToken = jwtDecode(token)
    const currentTime = Date.now() / 1000
    return decodedToken.exp < currentTime
  } catch (_err) {
    return true
  }
}

const protect = async (req, res, next) => {
  const accesspath = req.path.replace('/', '')
  const token = req.cookies.accessToken
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' })

  try {
    if (isTokenExpired(token)) {
      return next(new Error('Authorization token has expired'))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findOne({
      where: { user_id: decoded.id, is_deleted: 0 },
    })

    if (!user) {
      return next(new Error('Authorization failed'))
    }

    const isAllowed = await validateRouteAccess(accesspath, user.user_type)
    if (isAllowed) {
      req.user = user
      next()
    } else {
      return next(new Error('Not authorised to access this route'))
    }
  } catch (err) {
    return next(new Error(err.message || 'Authorization failed'))
  }
}

export default protect
