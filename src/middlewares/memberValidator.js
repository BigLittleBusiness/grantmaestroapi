import Joi from 'joi'

export const addMemberValidation = (req, res, next) => {
  const { first_name, last_name, email, member_type, position_id, position_text, address } = req.body
  const { error } = Joi.object({
    first_name: Joi.string().label('First Name').required(),
    last_name: Joi.string().label('Last Name').required(),
    email: Joi.string().label('Email').required(),
    member_type: Joi.number().label('Member Type').required(),
    position_id: Joi.number().label('Position').optional(),
    position_text: Joi.string().label('Position Title').optional(),
    address: Joi.string().label('Address').allow(null, '').optional(),
  }).validate({ first_name, last_name, email, member_type, position_id, position_text, address })
  if (error) {
    return res.status(422).json({ success: false, message: error.details[0].message })
  }
  next()
}
