import ErrorResponse from '../utils/errorResponse.js'

const errorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message
  console.log(error)

  if (err.name === 'CastError') {
    const message = `Resource not found with id ${err.value}`
    error = new ErrorResponse(message, 404)
  }
  //Mongoose duplicate key
  if (err.code === 11000) {
    const message = `Duplicate field value entered`
    error = new ErrorResponse(message, 200)
  }
  if (err.name === 'ValidatorError' || err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message)
    error = new ErrorResponse(message, 200)
  }
  if (error.message === 'Authorization token has expired') {
    error.statusCode = 403
  }
  res.status(error.statusCode || 500).send({
    success: false,
    message: error.message || 'Server Error',
  })
}

export default errorHandler
