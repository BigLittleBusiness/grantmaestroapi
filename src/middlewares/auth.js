import jwt from 'jsonwebtoken'
import { jwtDecode } from 'jwt-decode'
import base from '../models/base.js'
const { Op, User } = base
import { validateRouteAccess } from '../utils/routeAccessHelper.js'

const isTokenExpired = (token) => {
  try {
    const decodedToken = jwtDecode(token)
    const currentTime = Date.now() / 1000
    return decodedToken.exp < currentTime
  } catch (error) {
    return true
  }
}

// const verifyRefreshToken = (req, res, next) => {
//   const token = req.cookies.accessToken
//   if (!token) return res.status(401).json({ message: 'Unauthorized' })

//   try {
//     req.user = jwt.verify(token, SECRET_KEY)
//     next()
//   } catch (error) {
//     res.status(403).json({ message: 'Invalid token' })
//   }
// }

const protect = async (req, res, next) => {
  var accesspath = req.path.replace('/', '')
  const token = req.cookies.accessToken
  if (!token) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const exp = isTokenExpired(token)
    if (exp === true) {
      return next(new Error('Authorization token has expired', 403))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findOne({
      where: { user_id: decoded.id },
    }) //attributes:{exclude:['password']}
    if (!user) {
      throw next(new Error('Authorization failed', 401))
    }
    //neded to collect the information of the user type
    let isAllowToAccessRoutPath = await validateRouteAccess(
      accesspath,
      user.user_type
    ) // need to decide from the access details
    if (isAllowToAccessRoutPath) {
      req.user = user
      next()
    } else {
      return next(new Error('Not authorize to access this route', 401))
    }
  } catch (err) {
    //console.log(err)
    throw next(new Error(err, 401))
  }
}

export default protect
