import asyncHandler from '../middlewares/async.js'
import CommonHelper from '../utils/commonHelper.js'
import base from '../models/base.js'
import sendEmail from '../utils/mailHelper.js'
const { User, Grant, Task, TaskChecklistItem } = base

const findOwnedGrant = (grantId, organizationId) =>
  Grant.findOne({
    where: { organization_grant_id: grantId, organization_id: organizationId, is_deleted: 0 },
  })

const findOwnedTask = (taskId, organizationId) =>
  Task.findOne({
    where: { task_id: taskId, is_deleted: 0 },
    include: [
      {
        model: Grant,
        as: 'grant',
        attributes: ['organization_grant_id', 'grant_title', 'organization_id'],
        where: { organization_id: organizationId, is_deleted: 0 },
        required: true,
      },
      {
        model: User,
        as: 'assigned_member',
        attributes: ['first_name', 'middle_name', 'last_name', 'email'],
        required: false,
      },
      {
        model: TaskChecklistItem,
        as: 'checklist_items',
        attributes: ['task_checklist_item_id', 'item_text', 'is_complete', 'completed_at'],
        required: false,
      },
    ],
  })

const normaliseChecklist = (items) => Array.isArray(items)
  ? [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 25)
  : []

const replaceChecklist = async (taskId, items) => {
  if (!Array.isArray(items)) return
  await TaskChecklistItem.update({ is_deleted: 1, modified_at: new Date() }, { where: { task_id: taskId, is_deleted: 0 } })
  const checklist = normaliseChecklist(items)
  if (checklist.length) {
    await TaskChecklistItem.bulkCreate(checklist.map((item_text) => ({ task_id: taskId, item_text })))
  }
}

const formatChecklist = (items = []) => items.map((item) => ({
  id: item.task_checklist_item_id,
  text: item.item_text,
  is_complete: Boolean(item.is_complete),
  completed_at: item.completed_at,
}))

// Helper: build full task email data
const buildTaskEmailData = (taskInfo, assignedTeamMember, relatedGrant) => {
  const assignedTo = `${assignedTeamMember?.first_name || ''} ${assignedTeamMember?.last_name || ''}`.trim()
  const priorityClass = taskInfo.task_priority === 'high' ? 'high' : taskInfo.task_priority === 'medium' ? 'medium' : ''
  const loginUrl = process.env.FRONTEND_URL + '/login'
  const taskUrl = process.env.FRONTEND_URL + '/tasks'
  const grantUrl = process.env.FRONTEND_URL + '/grant/details/' + taskInfo.organization_grant_id
  return {
    assignedTo,
    grantTitle: relatedGrant.grant_title,
    task_description: taskInfo.task_description,
    targeted_completion_date: taskInfo.targeted_completion_date
      ? new Date(taskInfo.targeted_completion_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Not set',
    task_status: taskInfo.task_status,
    task_priority: taskInfo.task_priority || 'Normal',
    priorityClass,
    recipientEmail: assignedTeamMember?.email,
    loginUrl,
    taskUrl,
    grantUrl,
    year: new Date().getFullYear(),
  }
}

/**
 * @description Assign a task to a team member
 * @route POST /task/assign
 * @access Private
 */
export const assignTask = asyncHandler(async (req, res, next) => {
  const {
    grant_id,
    task_description,
    task_assigned_to,
    targeted_completion_date,
    task_priority,
    task_status,
    task_type,
    grant_stage,
    estimated_effort_hours,
    dependency_note,
    completion_evidence,
    checklist_items,
  } = req.body
  const ownedGrant = await findOwnedGrant(grant_id, req.user.organization_id)
  if (!ownedGrant) {
    return res.status(404).json({ status: false, message: 'Grant not found.', data: {} })
  }
  const assignee = await User.findOne({
    where: { user_id: task_assigned_to, organization_id: req.user.organization_id, is_deleted: 0 },
  })
  if (!assignee) {
    return res.status(422).json({ status: false, message: 'Please select a team member from your organisation.', data: {} })
  }

  const taskObj = {
    task_description,
    task_assigned_to,
    targeted_completion_date: new Date(targeted_completion_date),
    organization_grant_id: grant_id,
    task_priority: task_priority || null,
    task_status: task_status || 'assigned',
    task_type: task_type || null,
    grant_stage: grant_stage || null,
    estimated_effort_hours: estimated_effort_hours || null,
    dependency_note: dependency_note || null,
    completion_evidence: completion_evidence || null,
  }
  const taskData = await Task.create(taskObj)
  const checklist = normaliseChecklist(checklist_items)
  if (checklist.length) {
    await TaskChecklistItem.bulkCreate(checklist.map((item_text) => ({ task_id: taskData.task_id, item_text })))
  }
  const taskInfo = await Task.findOne({
    where: { task_id: taskData.task_id },
    include: [
      { model: Grant, as: 'grant', attributes: ['grant_title'], required: true },
      { model: User, as: 'assigned_member', attributes: ['first_name', 'middle_name', 'last_name', 'email'], required: false },
      { model: TaskChecklistItem, as: 'checklist_items', attributes: ['task_checklist_item_id', 'item_text', 'is_complete', 'completed_at'], required: false },
    ],
  })
  const assignedTeamMember = taskInfo.assigned_member.dataValues
  const relatedGrant = taskInfo.grant.dataValues
  const assignedTo = `${assignedTeamMember?.first_name} ${assignedTeamMember?.last_name}`

  sendEmail(
    assignedTeamMember?.email,
    'New Task Assigned — Grant Maestro',
    'taskUpdate',
    buildTaskEmailData(taskInfo, assignedTeamMember, relatedGrant),
    null
  )

  res.send({
    status: true,
    message: 'Task assigned successfully',
    data: {
      task: {
        id: taskInfo.task_id,
        description: taskInfo.task_description,
        status: taskInfo.task_status,
        priority: taskInfo.task_priority,
        task_type: taskInfo.task_type,
        grant_stage: taskInfo.grant_stage,
        estimated_effort_hours: taskInfo.estimated_effort_hours,
        dependency_note: taskInfo.dependency_note,
        completion_evidence: taskInfo.completion_evidence,
        checklist_items: formatChecklist(taskInfo.checklist_items),
        task_assigned_to_id: taskInfo.task_assigned_to,
        grant_id: taskInfo.organization_grant_id,
        assignedTo: assignedTo,
        task_assigned_to_name: assignedTo,
        grant: relatedGrant.grant_title,
        targeted_completion_date: taskInfo.targeted_completion_date,
      },
    },
  })
})

/**
 * @description Update an existing task
 * @route POST /task/update/:task_id
 * @access Private
 */
export const updateTask = asyncHandler(async (req, res, next) => {
  const taskId = req.params.task_id
  const existingTask = await findOwnedTask(taskId, req.user.organization_id)
  if (!existingTask) {
    return res.status(404).json({ status: false, message: 'Task not found.', data: {} })
  }
  const {
    task_description,
    task_status,
    task_assigned_to,
    targeted_completion_date,
    grant_id,
    task_priority,
    task_type,
    grant_stage,
    estimated_effort_hours,
    dependency_note,
    completion_evidence,
    checklist_items,
  } = req.body

  const ownedGrant = await findOwnedGrant(grant_id, req.user.organization_id)
  if (!ownedGrant) {
    return res.status(422).json({ status: false, message: 'Please select a grant from your organisation.', data: {} })
  }
  const assignee = await User.findOne({
    where: { user_id: task_assigned_to, organization_id: req.user.organization_id, is_deleted: 0 },
  })
  if (!assignee) {
    return res.status(422).json({ status: false, message: 'Please select a team member from your organisation.', data: {} })
  }

  await Task.update(
    {
      task_description,
      task_status,
      task_assigned_to,
      task_priority: task_priority !== undefined ? task_priority || null : existingTask.task_priority,
      task_type: task_type !== undefined ? task_type || null : existingTask.task_type,
      grant_stage: grant_stage !== undefined ? grant_stage || null : existingTask.grant_stage,
      estimated_effort_hours: estimated_effort_hours !== undefined ? estimated_effort_hours || null : existingTask.estimated_effort_hours,
      dependency_note: dependency_note !== undefined ? dependency_note || null : existingTask.dependency_note,
      completion_evidence: completion_evidence !== undefined ? completion_evidence || null : existingTask.completion_evidence,
      task_start_date: new Date(),
      targeted_completion_date: new Date(targeted_completion_date),
      task_completion_date: task_status === 'completed' ? new Date() : null,
      organization_grant_id: grant_id,
      modified_at: new Date(),
    },
    { where: { task_id: taskId } }
  )
  await replaceChecklist(taskId, checklist_items)
  const taskInfo = await Task.findOne({
    where: { task_id: taskId },
    include: [
      { model: Grant, as: 'grant', attributes: ['grant_title', 'organization_id'], required: true },
      { model: User, as: 'assigned_member', attributes: ['first_name', 'middle_name', 'last_name', 'email'], required: false },
      { model: TaskChecklistItem, as: 'checklist_items', attributes: ['task_checklist_item_id', 'item_text', 'is_complete', 'completed_at'], required: false },
    ],
  })
  const assignedTeamMember = taskInfo.assigned_member?.dataValues || {}
  const relatedGrant = taskInfo.grant.dataValues
  const assignedTo = `${assignedTeamMember?.first_name || ''} ${assignedTeamMember?.last_name || ''}`.trim()

  // Send task-updated notification to assignee
  if (assignedTeamMember?.email) {
    sendEmail(
      assignedTeamMember.email,
      'Task Updated — Grant Maestro',
      'taskUpdate',
      buildTaskEmailData(taskInfo, assignedTeamMember, relatedGrant),
      null
    )
  }

  // If task is now completed, notify the org admin
  if (task_status === 'completed') {
    const orgAdmin = await User.findOne({
      where: { organization_id: relatedGrant.organization_id, user_type: 1, is_deleted: 0 },
      attributes: ['email', 'first_name'],
    })
    if (orgAdmin) {
      sendEmail(
        orgAdmin.email,
        'Task Completed — Grant Maestro',
        'taskCompleted',
        {
          completedBy: assignedTo || 'A team member',
          grantTitle: relatedGrant.grant_title,
          task_description: taskInfo.task_description,
          completedDate: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
          grantUrl: process.env.FRONTEND_URL + '/grant/details/' + taskInfo.organization_grant_id,
          loginUrl: process.env.FRONTEND_URL + '/login',
          recipientEmail: orgAdmin.email,
          year: new Date().getFullYear(),
        },
        null
      )
    }
  }

  res.send({
    status: true,
    message: 'Task updated successfully',
    data: {
      task: {
        id: taskInfo.task_id,
        description: taskInfo.task_description,
        status: taskInfo.task_status,
        priority: taskInfo.task_priority,
        task_type: taskInfo.task_type,
        grant_stage: taskInfo.grant_stage,
        estimated_effort_hours: taskInfo.estimated_effort_hours,
        dependency_note: taskInfo.dependency_note,
        completion_evidence: taskInfo.completion_evidence,
        checklist_items: formatChecklist(taskInfo.checklist_items),
        task_assigned_to_id: taskInfo.task_assigned_to,
        grant_id: taskInfo.organization_grant_id,
        assignedTo: assignedTo,
        task_assigned_to_name: assignedTo,
        grant: relatedGrant.grant_title,
        targeted_completion_date: taskInfo.targeted_completion_date,
      },
    },
  })
})

/**
 * @description Update the status of a task
 * @route POST /task/status-update/:task_id
 * @access Private
 */
export const updateTaskStatus = asyncHandler(async (req, res, next) => {
  const taskId = req.params.task_id
  const { task_status, completion_evidence } = req.body
  if (!['assigned', 'pending', 'inprogress', 'completed'].includes(task_status)) {
    return res.status(422).json({ status: false, message: 'Please select a valid task status.' })
  }
  const task = await findOwnedTask(taskId, req.user.organization_id)
  if (!task) {
    return res.status(404).json({ status: false, message: 'Task not found.', data: {} })
  }
  if (req.user.user_type !== 1 && Number(task.task_assigned_to) !== Number(req.user.user_id)) {
    return res.status(403).json({ status: false, message: 'You can only update tasks assigned to you.' })
  }
  await Task.update(
    {
      task_status,
      completion_evidence: completion_evidence !== undefined ? String(completion_evidence || '').trim() || null : task.completion_evidence,
      task_completion_date: task_status === 'completed' ? new Date() : null,
      modified_at: new Date(),
    },
    { where: { task_id: taskId } }
  )

  // If completed, notify the org admin
  if (task_status === 'completed') {
    const taskInfo = await Task.findOne({
      where: { task_id: taskId },
      include: [
        { model: Grant, as: 'grant', attributes: ['grant_title', 'organization_id'], required: true },
        { model: User, as: 'assigned_member', attributes: ['first_name', 'last_name', 'email'], required: false },
      ],
    })
    if (taskInfo) {
      const relatedGrant = taskInfo.grant.dataValues
      const assignedTeamMember = taskInfo.assigned_member?.dataValues || {}
      const completedBy = `${assignedTeamMember?.first_name || ''} ${assignedTeamMember?.last_name || ''}`.trim() || 'A team member'
      const orgAdmin = await User.findOne({
        where: { organization_id: relatedGrant.organization_id, user_type: 1, is_deleted: 0 },
        attributes: ['email'],
      })
      if (orgAdmin) {
        sendEmail(
          orgAdmin.email,
          'Task Completed — Grant Maestro',
          'taskCompleted',
          {
            completedBy,
            grantTitle: relatedGrant.grant_title,
            task_description: taskInfo.task_description,
            completedDate: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
            grantUrl: process.env.FRONTEND_URL + '/grant/details/' + taskInfo.organization_grant_id,
            loginUrl: process.env.FRONTEND_URL + '/login',
            recipientEmail: orgAdmin.email,
            year: new Date().getFullYear(),
          },
          null
        )
      }
    }
  }

  res.send({ status: true, message: 'Task status updated successfully', data: {} })
})

/**
 * @description Fetch the list of tasks
 * @route GET /task/list
 * @access Private
 */
export const fetchTaskList = asyncHandler(async (req, res, next) => {
  const userId = req.user.user_id
  const organizationId = req.user.organization_id
  const userType = req.user.user_type

  let findCond = { is_blocked: 0, is_deleted: 0 }
  if (userType == 3 || userType == 4) {
    findCond.task_assigned_to = userId
  }
  if (req.query.grant_id) {
    findCond.organization_grant_id = req.query.grant_id
  }
  if (req.query.task_assigned_to) {
    findCond.task_assigned_to = req.query.task_assigned_to
  }
  if (req.query.task_status) {
    findCond.task_status = req.query.task_status
  }
  const taskList = await Task.findAll({
    attributes: ['task_id', 'task_description', 'task_status', 'task_priority', 'task_type', 'grant_stage', 'estimated_effort_hours', 'dependency_note', 'completion_evidence', 'task_assigned_to', 'organization_grant_id', 'targeted_completion_date'],
    where: findCond,
    include: [
      { model: Grant, as: 'grant', attributes: ['grant_title'], where: { organization_id: organizationId }, required: true },
      { model: User, as: 'assigned_member', attributes: ['first_name', 'middle_name', 'last_name', 'email'], required: false },
    ],
  })
  const tasks = taskList.map((el) => ({
    id: el.task_id,
    description: el.task_description,
    status: el.task_status,
    priority: el.task_priority,
    task_type: el.task_type,
    grant_stage: el.grant_stage,
    estimated_effort_hours: el.estimated_effort_hours,
    dependency_note: el.dependency_note,
    completion_evidence: el.completion_evidence,
    task_assigned_to_id: el.task_assigned_to,
    targeted_completion_date: el.targeted_completion_date,
    task_assigned_to_name: el.assigned_member
      ? CommonHelper.formatFullName(el.assigned_member.first_name, el.assigned_member.middle_name, el.assigned_member.last_name)
      : '',
    grant_id: el.organization_grant_id,
    grant: el.grant.grant_title,
    assignedTo: el.assigned_member
      ? CommonHelper.formatFullName(el.assigned_member.first_name, el.assigned_member.middle_name, el.assigned_member.last_name)
      : '',
  }))
  res.send({ status: true, message: 'Task list', data: { tasks } })
})

/**
 * @description Get details of a specific task
 * @route GET /task/details/:task_id
 * @access Private
 */
export const getTaskDetails = asyncHandler(async (req, res, next) => {
  const taskId = req.params.task_id
  const taskdata = await findOwnedTask(taskId, req.user.organization_id)
  if (!taskdata) {
    return res.status(404).json({ status: false, message: 'Task not found.', data: {} })
  }
  if (req.user.user_type !== 1 && Number(taskdata.task_assigned_to) !== Number(req.user.user_id)) {
    return res.status(403).json({ status: false, message: 'You do not have permission to view this task.' })
  }

  const task = {
    task_id: taskdata.task_id,
    task_description: taskdata.task_description,
    task_status: taskdata.task_status,
    priority: taskdata.task_priority,
    task_type: taskdata.task_type,
    grant_stage: taskdata.grant_stage,
    estimated_effort_hours: taskdata.estimated_effort_hours,
    dependency_note: taskdata.dependency_note,
    completion_evidence: taskdata.completion_evidence,
    checklist_items: formatChecklist(taskdata.checklist_items),
    targeted_completion_date: taskdata.targeted_completion_date,
    task_start_date: taskdata.task_start_date,
    task_assigned_to_id: taskdata.task_assigned_to,
    task_assigned_to_name: taskdata.assigned_member
      ? CommonHelper.formatFullName(taskdata.assigned_member.first_name, taskdata.assigned_member.middle_name, taskdata.assigned_member.last_name)
      : '',
    grant_id: taskdata.organization_grant_id,
    grant: taskdata.grant.grant_title,
  }
  res.send({ status: true, message: 'Task information', data: { task } })
})

/**
 * @description Remove a task by marking it as deleted
 * @route DELETE /task/remove/:task_id
 * @access Private
 */
export const removeTask = asyncHandler(async (req, res, next) => {
  if (Number(req.user.user_type) !== 1) {
    return res.status(403).json({ status: false, message: 'Only an Organisation Admin can delete a task.' })
  }
  const taskId = req.params.task_id
  const task = await findOwnedTask(taskId, req.user.organization_id)
  if (!task) {
    return res.status(404).json({ status: false, message: 'Task not found.', data: {} })
  }
  await Task.update(
    { is_deleted: 1, deleted_at: new Date() },
    { where: { task_id: taskId } }
  )
  res.send({ status: true, message: 'Task removed successfully', data: {} })
})

/**
 * @description Fetch the list of tasks related to a specific grant
 * @route GET /task/grant-related/:grant_id
 * @access Private
 */
export const fetchGrantRelatedTaskList = asyncHandler(async (req, res, next) => {
  const grantId = req.params.grant_id
  const ownedGrant = await findOwnedGrant(grantId, req.user.organization_id)
  if (!ownedGrant) {
    return res.status(404).json({ status: false, message: 'Grant not found.', data: {} })
  }
  const userId = req.user.user_id
  const userRole = req.user.user_type
  if (userRole == 3 || userRole == 4) {
    const taskInfo = await Task.findOne({ where: { task_assigned_to: userId, organization_grant_id: grantId } })
    if (!taskInfo) {
      return res.send({ status: false, message: 'You do not have permission to access this information.' })
    }
  }
  const taskList = await Task.findAll({
    where: { organization_grant_id: grantId, is_deleted: 0 },
    include: [
      { model: Grant, as: 'grant', attributes: ['grant_title'], required: true },
      { model: User, as: 'assigned_member', attributes: ['first_name', 'middle_name', 'last_name', 'email'], required: false },
    ],
    order: [['task_id', 'desc']],
  })
  res.send({ status: true, message: 'Task list', data: { tasks: taskList } })
})

/**
 * Update a single shared checklist item. Assigned staff may complete only
 * checklist work attached to their own task; Organisation Admins may update any.
 */
export const updateTaskChecklistItem = asyncHandler(async (req, res) => {
  const { is_complete } = req.body
  if (typeof is_complete !== 'boolean') {
    return res.status(422).json({ status: false, message: 'Provide a checklist completion value.' })
  }
  const item = await TaskChecklistItem.findOne({
    where: { task_checklist_item_id: req.params.item_id, is_deleted: 0 },
    include: [{
      model: Task,
      as: 'task',
      required: true,
      include: [{
        model: Grant,
        as: 'grant',
        where: { organization_id: req.user.organization_id, is_deleted: 0 },
        required: true,
      }],
    }],
  })
  if (!item) return res.status(404).json({ status: false, message: 'Checklist item not found.' })
  if (Number(req.user.user_type) !== 1 && Number(item.task.task_assigned_to) !== Number(req.user.user_id)) {
    return res.status(403).json({ status: false, message: 'You can only update checklist items assigned to you.' })
  }
  await item.update({
    is_complete,
    completed_at: is_complete ? new Date() : null,
    completed_by_user_id: is_complete ? req.user.user_id : null,
    modified_at: new Date(),
  })
  res.json({ status: true, message: 'Checklist item updated.', data: { item: { id: item.task_checklist_item_id, is_complete: item.is_complete } } })
})
