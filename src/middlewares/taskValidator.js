import Joi from 'joi'

export const assignTaskValidation = (req, res, next) => {
  const {
    grant_id,
    task_description,
    task_assigned_to,
    targeted_completion_date,
    task_status,
    task_priority,
  } = req.body
  const inputData = {
    grant_id,
    task_description,
    task_assigned_to,
    targeted_completion_date,
    task_status,
    task_priority,
  }

  const schema = Joi.object({
    grant_id: Joi.number()
      .label('Grant Id')
      .required()
      .description('Please provide grant id'),
    task_description: Joi.string()
      .label('Task Description')
      .required()
      .description('Please provide task description'),
    task_assigned_to: Joi.number()
      .label('Team Member')
      .required()
      .description('Please select team member whom you are assigning the task'),
    targeted_completion_date: Joi.date()
      .label('Due Date')
      .required()
      .description('Please enter due date'),
    task_status: Joi.string()
      .valid('assigned', 'pending', 'inprogress', 'completed')
      .label('Task Status')
      .optional(),
    task_priority: Joi.string()
      .valid('high', 'medium', 'low')
      .label('Priority')
      .optional()
      .allow(null, ''),
  })

  const { error } = schema.validate(inputData)
  if (error) {
    return res.status(422).json({ success: false, message: error.details[0].message })
  }
  next()
}

export const updateTaskValidation = (req, res, next) => {
  const {
    grant_id,
    task_description,
    task_assigned_to,
    targeted_completion_date,
    task_status,
    task_priority,
  } = req.body
  const inputData = {
    grant_id,
    task_description,
    task_assigned_to,
    targeted_completion_date,
    task_status,
    task_priority,
  }

  const schema = Joi.object({
    grant_id: Joi.number()
      .label('Grant Id')
      .required()
      .description('Please provide grant id'),
    task_description: Joi.string()
      .label('Task Description')
      .required()
      .description('Please provide task description'),
    task_assigned_to: Joi.number()
      .label('Team Member')
      .required()
      .description('Please select team member whom you are assigning the task'),
    targeted_completion_date: Joi.date()
      .label('Due Date')
      .required()
      .description('Please enter due date'),
    task_status: Joi.string()
      .valid('assigned', 'pending', 'inprogress', 'completed')
      .label('Task Status')
      .optional(),
    task_priority: Joi.string()
      .valid('high', 'medium', 'low')
      .label('Priority')
      .optional()
      .allow(null, ''),
  })

  const { error } = schema.validate(inputData)
  if (error) {
    return res.status(422).json({ success: false, message: error.details[0].message })
  }
  next()
}
