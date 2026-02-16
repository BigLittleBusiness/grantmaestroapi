import Joi from 'joi';


export const signupValidation = (req, res, next) => {
    const { email, password, preferred_subscription_plan_id } = req.body;
    const inputData = {
        password,
        email,
        preferred_subscription_plan_id
    }

    const schema = Joi.object({
        email: Joi.string().label('Email').required().description("The email field is required."),
        password: Joi.string().label('Password')
            .min(8)
            .max(50),
        preferred_subscription_plan_id:Joi.number().label('Subscription Plan').required().description('Please choose a preferred subscription plan')
    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}

export const loginValidation = (req, res, next) => {
    const { email, password } = req.body;
    const inputData = {
        email, 
        password
    }

    const schema = Joi.object({
        email: Joi.string().label('Email').required(),
        password: Joi.string().label('Password')
            .min(8)
            .max(50)
    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}


export const updateProfileValidation = (req, res, next) =>{
    const { email, first_name, last_name, phone_no, profile_image, organization_name, organization_website, organization_logo, address, abn_no, state, country } = req.body;
    const inputData = {
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
        country
    }

    const schema = Joi.object({
        email:Joi.string().label('Email').required().description("Please enter email."),
        first_name: Joi.string().label('First Name').required(),
        // middle_name: Joi.string().label('Middle Name').required(),
        last_name: Joi.string().label('Last Name').required(),
        profile_image: Joi.string().label('Profile Picture').optional(),
        organization_name: Joi.string().label('Organization Name').required(),
        organization_website: Joi.string().label('Organization Website').required(),
        organization_logo: Joi.string().label('Organization Logo').optional(),
        address: Joi.string().label('Address').required(),
        phone_no: Joi.string().label('Phone').required(),
        abn_no: Joi.string().label('ABN No.').required(),
        state: Joi.number().label('State').optional(),
        country: Joi.number().label('Country').optional()
    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}

export const forgotPassValidation = (req, res, next) => {
    const { email } = req.body;
    const inputData = {
        email
    }

    const schema = Joi.object({
        email: Joi.string().label('Email').required()
    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}

export const resetPassValidation = (req, res, next) => {
    const { identity, salt, password } = req.body;
    const inputData = {
        identity, salt, password
    }

    const schema = Joi.object({
        identity: Joi.string().label('Identity').required(),
        salt: Joi.string().label('Salt').required(),
        password: Joi.string().label('Password')
            .min(8)
            .max(50)

    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}

export const changePassValidation = (req, res, next) => {
    const { old_password, new_password } = req.body;
    const inputData = {
        old_password, 
        new_password
    }

    const schema = Joi.object({
        old_password: Joi.string().label('Password')
            .min(8)
            .max(50),
        new_password: Joi.string().label('Password')
            .min(8)
            .max(50),
    })

   const {error} =  schema.validate(inputData);
   if(error){
    return res.status(501).json({error: error.details[0].message});
   };
   next()
}