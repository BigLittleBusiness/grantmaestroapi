import Joi from 'joi'

const taskSchema = Joi.object({
  grant_id: Joi.number().label('Grant Id').required().description('Please provide grant id'),
  task_description: Joi.string().trim().max(5000).label('Task Description').required().description('Please provide task description'),
  task_assigned_to: Joi.number().label('Team Member').required().description('Please select team member whom you are assigning the task'),
  targeted_completion_date: Joi.date().label('Due Date').required().description('Please enter due date'),
  task_status: Joi.string().valid('assigned', 'pending', 'inprogress', 'completed').label('Task Status').optional(),
  task_priority: Joi.string().valid('high', 'medium', 'low').label('Priority').optional().allow(null, ''),
  task_type: Joi.string().valid('research', 'application', 'evidence', 'finance', 'review', 'approval', 'communication', 'other').label('Task type').optional().allow(null, ''),
  grant_stage: Joi.string().valid('opportunity', 'suitability', 'submitted', 'outcome', 'acquittal').label('Grant stage').optional().allow(null, ''),
  estimated_effort_hours: Joi.number().min(0).max(9999).label('Estimated effort').optional().allow(null, ''),
  dependency_note: Joi.string().allow('', null).max(5000),
  completion_evidence: Joi.string().allow('', null).max(10000),
  checklist_items: Joi.array().items(Joi.string().trim().min(1).max(500)).max(25).optional(),
})

const validate = (req, res, next) => {
  const { error } = taskSchema.validate(req.body, { abortEarly: true, stripUnknown: false })
  if (error) return res.status(422).json({ success: false, message: error.details[0].message })
  next()
}

export const assignTaskValidation = validate
export const updateTaskValidation = validate
