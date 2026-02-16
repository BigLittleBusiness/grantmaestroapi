import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'

const { Op, Grant, Task, Organization } = base

/**
 * @description Fetches calendar events for the logged-in user based on their user type and organization.
 *              The events include grants and their associated tasks.
 * @route GET /api/admin/calendar-events
 * @access Private
 */
export const getCalendarEvents = asyncHandler(async (req, res, next) => {
  const userId = req.user.user_id
  const organizationId = req.user.organization_id
  const userType = req.user.user_type

  const taskFindCond = { is_deleted: false }
  const eventFindCond = { organization_id: organizationId, is_deleted: false }

  // Find team member-related grants if the user is a team member or staff
  if (userType == 3 || userType == 4) {
    const relatedTasks = await Task.findAll({
      attributes: ['task_id', 'organization_grant_id'],
      where: { task_assigned_to: userId },
    })
    const grantIds = relatedTasks.map((el) => el.organization_grant_id)
    eventFindCond.organization_grant_id = {
      [Op.in]: grantIds,
    }
    taskFindCond.task_assigned_to = userId
  }

  // Fetch grants and their associated tasks
  const eventList = await Grant.findAll({
    attributes: [
      'organization_grant_id',
      'grant_title',
      'opening_date',
      'closing_date',
    ],
    where: eventFindCond,
    include: [
      {
        model: Task,
        as: 'tasks',
        attributes: ['task_id', 'task_description', 'targeted_completion_date'],
        where: taskFindCond,
        required: false,
      },
    ],
  })

  const events = []

  // Map grants and tasks to calendar events
  eventList.map((el) => {
    const gObj = {
      title: el.grant_title,
      start: new Date(el.opening_date),
      end: new Date(el.closing_date),
    }
    events.push(gObj)

    if (el.tasks.length > 0) {
      el.tasks.map((grantTask) => {
        events.push({
          title: grantTask.task_description,
          start: new Date(grantTask.targeted_completion_date),
          end: new Date(grantTask.targeted_completion_date),
        })
      })
    }
  })

  // Send response with events
  res.send({
    status: true,
    message: 'Dashboard data fetched successfully.',
    data: { events },
  })
})

export const getOrganizationList = asyncHandler(async (req, res, next)=>{
  const list = await Organization.findAll({
    attributes:['organization_id','organization_name','abn_no','phone_no','organization_website'],
    where:{is_deleted:0},
    order:[['organization_id','desc']]
  })

  res.send({
    status: true,
    message: 'Dashboard data fetched successfully.',
    data: { list },
  })

})