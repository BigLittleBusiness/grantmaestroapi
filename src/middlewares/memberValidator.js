import Joi from 'joi';

export const addMemberValidation = (req, res, next) => {
    const {first_name, last_name, email, member_type, position_id, position_text, address } = req.body;
    const inputData = {
        first_name,
        last_name,
        email,
        member_type,
        position_id,
        position_text,
        address
    }

    const schema = Joi.object({
        first_name: Joi.string().required(),
        last_name: Joi.string().required(),
        email: Joi.string().required(),
        member_type: Joi.number().required(),
        position_id: Joi.number().optional(),
        position_text: Joi.string().optional(),
        address: Joi.string().allow(null, '').optional()
    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}

