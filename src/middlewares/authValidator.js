import Joi from 'joi'

const validationError = (res, error) =>
  res.status(422).json({ success: false, message: error.details[0].message })

export const signupValidation = (req, res, next) => {
  const { email, password, preferred_subscription_plan_id } = req.body
  const { error } = Joi.object({
    email: Joi.string().label('Email').required(),
    password: Joi.string().label('Password').min(8).max(50),
    preferred_subscription_plan_id: Joi.number()
      .label('Subscription Plan')
      .required()
      .description('Please choose a preferred subscription plan'),
  }).validate({ email, password, preferred_subscription_plan_id })
  if (error) return validationError(res, error)
  next()
}

export const loginValidation = (req, res, next) => {
  const { email, password } = req.body
  const { error } = Joi.object({
    email: Joi.string().label('Email').required(),
    password: Joi.string().label('Password').min(8).max(50),
  }).validate({ email, password })
  if (error) return validationError(res, error)
  next()
}

export const updateProfileValidation = (req, res, next) => {
  const {
    email,
    first_name,
    last_name,
    phone_no,
    profile_image,
    organization_name,
    organization_website,
    organization_logo,
    abn_no,
    address,
    state,
    country,
  } = req.body
  const { error } = Joi.object({
    email: Joi.string().label('Email').required(),
    first_name: Joi.string().label('First Name').required(),
    last_name: Joi.string().label('Last Name').required(),
    profile_image: Joi.string().label('Profile Picture').optional(),
    organization_name: Joi.string().label('Organization Name').required(),
    organization_website: Joi.string().label('Organization Website').required(),
    organization_logo: Joi.string().label('Organization Logo').optional(),
    address: Joi.string().label('Address').required(),
    phone_no: Joi.string().label('Phone').required(),
    abn_no: Joi.string().label('ABN No.').required(),
    state: Joi.number().label('State').optional(),
    country: Joi.number().label('Country').optional(),
  }).validate({
    email,
    first_name,
    last_name,
    phone_no,
    profile_image,
    organization_name,
    organization_website,
    organization_logo,
    abn_no,
    address,
    state,
    country,
  })
  if (error) return validationError(res, error)
  next()
}

export const forgotPassValidation = (req, res, next) => {
  const { email } = req.body
  const { error } = Joi.object({
    email: Joi.string().label('Email').required(),
  }).validate({ email })
  if (error) return validationError(res, error)
  next()
}

export const resetPassValidation = (req, res, next) => {
  const { identity, salt, password } = req.body
  const { error } = Joi.object({
    identity: Joi.string().label('Identity').required(),
    salt: Joi.string().label('Salt').required(),
    password: Joi.string().label('Password').min(8).max(50),
  }).validate({ identity, salt, password })
  if (error) return validationError(res, error)
  next()
}

export const changePassValidation = (req, res, next) => {
  const { old_password, new_password } = req.body
  const { error } = Joi.object({
    old_password: Joi.string().label('Current Password').min(8).max(50),
    new_password: Joi.string().label('New Password').min(8).max(50),
  }).validate({ old_password, new_password })
  if (error) return validationError(res, error)
  next()
}
