import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'

const { Grant, User, Task, AcquittalItem, Op } = base

const STAGES = ['opportunity', 'suitability', 'submitted', 'outcome', 'acquittal']
const RISK_STATUSES = ['on_track', 'needs_attention', 'at_risk']
const ITEM_STATUSES = ['not_started', 'in_progress', 'ready_for_review', 'complete', 'not_required']
const ITEM_TYPES = ['evidence', 'finance', 'approval', 'submission']

const defaultChecklist = [
  ['Confirm funding agreement and reporting conditions', 'evidence'],
  ['Compile delivery outcomes and performance evidence', 'evidence'],
  ['Reconcile grant expenditure and remaining funds', 'finance'],
  ['Attach invoices, receipts and supporting financial evidence', 'finance'],
  ['Complete internal review of acquittal materials', 'approval'],
  ['Obtain authorised officer approval', 'approval'],
  ['Submit acquittal to the funding body', 'submission'],
  ['Record acknowledgement or final acceptance from the funder', 'submission'],
]

const findGrant = (grantId, organizationId) => Grant.findOne({
  where: { organization_grant_id: grantId, organization_id: organizationId, is_deleted: 0 },
  include: [{ model: User, as: 'accountable_officer', attributes: ['user_id', 'first_name', 'last_name', 'email'], required: false }],
})

const ensureChecklist = async (grantId, dueDate) => {
  const existing = await AcquittalItem.count({ where: { organization_grant_id: grantId, is_deleted: 0 } })
  if (existing) return
  await AcquittalItem.bulkCreate(defaultChecklist.map(([item_title, item_type]) => ({
    organization_grant_id: grantId,
    item_title,
    item_type,
    due_date: dueDate || null,
  })))
}

const formatGrant = (grant) => ({
  grant_id: grant.organization_grant_id,
  grant_title: grant.grant_title,
  fund_originator: grant.fund_originator,
  workflow_stage: grant.workflow_stage,
  next_action: grant.next_action,
  next_action_due_date: grant.next_action_due_date,
  risk_status: grant.risk_status,
  strategic_priority: grant.strategic_priority,
  closing_date: grant.closing_date,
  acquittal_date: grant.acquittal_date,
  funding_sought_amount: grant.funding_sought_amount,
  won_fund_amount: grant.won_fund_amount,
  accountable_officer: grant.accountable_officer ? {
    user_id: grant.accountable_officer.user_id,
    name: `${grant.accountable_officer.first_name || ''} ${grant.accountable_officer.last_name || ''}`.trim(),
    email: grant.accountable_officer.email,
  } : null,
})

export const updateGrantControlPanel = asyncHandler(async (req, res) => {
  const grant = await findGrant(req.params.grant_id, req.user.organization_id)
  if (!grant) return res.status(404).json({ status: false, message: 'Grant not found.' })

  const {
    workflow_stage,
    confirm_transition,
    next_action,
    next_action_due_date,
    accountable_user_id,
    risk_status,
    strategic_priority,
  } = req.body

  const update = {}
  if (workflow_stage !== undefined) {
    const stage = String(workflow_stage).toLowerCase()
    if (!STAGES.includes(stage)) return res.status(422).json({ status: false, message: 'Please select a valid workflow stage.' })
    if (stage !== grant.workflow_stage && confirm_transition !== true) {
      return res.status(422).json({ status: false, message: 'Confirm the lifecycle transition before changing the grant stage.' })
    }
    update.workflow_stage = stage
    if (stage === 'acquittal') await ensureChecklist(grant.organization_grant_id, grant.acquittal_date)
  }

  if (risk_status !== undefined) {
    const risk = String(risk_status).toLowerCase()
    if (!RISK_STATUSES.includes(risk)) return res.status(422).json({ status: false, message: 'Please select a valid risk status.' })
    update.risk_status = risk
  }
  if (next_action !== undefined) update.next_action = String(next_action || '').trim() || null
  if (next_action_due_date !== undefined) update.next_action_due_date = next_action_due_date || null
  if (strategic_priority !== undefined) update.strategic_priority = String(strategic_priority || '').trim() || null

  if (accountable_user_id !== undefined) {
    if (accountable_user_id === null || accountable_user_id === '') {
      update.accountable_user_id = null
    } else {
      const user = await User.findOne({
        where: { user_id: accountable_user_id, organization_id: req.user.organization_id, is_deleted: 0, is_blocked: 0 },
      })
      if (!user) return res.status(422).json({ status: false, message: 'The accountable officer must be an active user in your organisation.' })
      update.accountable_user_id = user.user_id
    }
  }

  if (!Object.keys(update).length) return res.status(422).json({ status: false, message: 'No workspace details were provided.' })
  update.modified_at = new Date()
  await Grant.update(update, { where: { organization_grant_id: grant.organization_grant_id } })
  const refreshed = await findGrant(grant.organization_grant_id, req.user.organization_id)
  res.json({ status: true, message: 'Grant workspace updated.', data: { grant: formatGrant(refreshed) } })
})

export const getGrantWorkspace = asyncHandler(async (req, res) => {
  const grant = await findGrant(req.params.grant_id, req.user.organization_id)
  if (!grant) return res.status(404).json({ status: false, message: 'Grant not found.' })
  const members = await User.findAll({
    attributes: ['user_id', 'first_name', 'last_name', 'email', 'user_type'],
    where: { organization_id: req.user.organization_id, is_deleted: 0, is_blocked: 0 },
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
  })
  const openTasks = await Task.findAll({
    attributes: ['task_id', 'task_description', 'task_status', 'task_priority', 'targeted_completion_date', 'task_assigned_to'],
    where: { organization_grant_id: grant.organization_grant_id, is_deleted: 0, task_status: { [Op.ne]: 'completed' } },
    include: [{ model: User, as: 'assigned_member', attributes: ['first_name', 'last_name'], required: false }],
    order: [['targeted_completion_date', 'ASC']],
  })
  res.json({
    status: true,
    message: 'Grant workspace loaded.',
    data: {
      grant: formatGrant(grant),
      members: members.map((member) => ({
        user_id: member.user_id,
        name: `${member.first_name || ''} ${member.last_name || ''}`.trim(),
        email: member.email,
        user_type: member.user_type,
      })),
      open_tasks: openTasks.map((task) => ({
        task_id: task.task_id,
        description: task.task_description,
        status: task.task_status,
        priority: task.task_priority,
        due_date: task.targeted_completion_date,
        assignee: task.assigned_member ? `${task.assigned_member.first_name || ''} ${task.assigned_member.last_name || ''}`.trim() : null,
      })),
    },
  })
})

export const getAcquittalCentre = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization_id
  let visibleGrantIds = null
  if (Number(req.user.user_type) !== 1) {
    const [taskRows, itemRows] = await Promise.all([
      Task.findAll({ attributes: ['organization_grant_id'], where: { task_assigned_to: req.user.user_id, is_deleted: 0 } }),
      AcquittalItem.findAll({ attributes: ['organization_grant_id'], where: { owner_user_id: req.user.user_id, is_deleted: 0 } }),
    ])
    visibleGrantIds = [...new Set([...taskRows, ...itemRows].map((row) => row.organization_grant_id))]
  }

  const where = {
    organization_id: organizationId,
    is_deleted: 0,
    [Op.or]: [{ workflow_stage: 'acquittal' }, { acquittal_date: { [Op.ne]: null } }],
  }
  if (visibleGrantIds !== null) {
    if (!visibleGrantIds.length) return res.json({ status: true, message: 'Acquittal centre loaded.', data: { grants: [] } })
    where.organization_grant_id = { [Op.in]: visibleGrantIds }
  }

  const grants = await Grant.findAll({
    where,
    include: [
      { model: User, as: 'accountable_officer', attributes: ['user_id', 'first_name', 'last_name'], required: false },
      { model: AcquittalItem, as: 'acquittal_items', required: false, include: [{ model: User, as: 'owner', attributes: ['user_id', 'first_name', 'last_name'], required: false }] },
    ],
    order: [['acquittal_date', 'ASC']],
  })
  res.json({
    status: true,
    message: 'Acquittal centre loaded.',
    data: {
      grants: grants.map((grant) => ({
        ...formatGrant(grant),
        acquittal_items: (grant.acquittal_items || []).map((item) => ({
          acquittal_item_id: item.acquittal_item_id,
          item_title: item.item_title,
          item_type: item.item_type,
          is_required: Boolean(item.is_required),
          status: item.status,
          owner_user_id: item.owner_user_id,
          owner_name: item.owner ? `${item.owner.first_name || ''} ${item.owner.last_name || ''}`.trim() : null,
          due_date: item.due_date,
          evidence_note: item.evidence_note,
          completed_at: item.completed_at,
        })),
      })),
    },
  })
})

export const initialiseAcquittalChecklist = asyncHandler(async (req, res) => {
  if (Number(req.user.user_type) !== 1) {
    return res.status(403).json({ status: false, message: 'Only an Organisation Admin can start an acquittal workflow.' })
  }
  const grant = await findGrant(req.params.grant_id, req.user.organization_id)
  if (!grant) return res.status(404).json({ status: false, message: 'Grant not found.' })
  await ensureChecklist(grant.organization_grant_id, grant.acquittal_date)
  await Grant.update({ workflow_stage: 'acquittal', modified_at: new Date() }, { where: { organization_grant_id: grant.organization_grant_id } })
  res.json({ status: true, message: 'Acquittal checklist started.' })
})

export const manageAcquittalItem = asyncHandler(async (req, res) => {
  const { action, acquittal_item_id, grant_id, item_title, item_type, is_required, status, owner_user_id, due_date, evidence_note } = req.body
  const isAdmin = Number(req.user.user_type) === 1

  if (action === 'add') {
    if (!isAdmin) return res.status(403).json({ status: false, message: 'Only an Organisation Admin can add checklist items.' })
    const grant = await findGrant(grant_id, req.user.organization_id)
    if (!grant) return res.status(404).json({ status: false, message: 'Grant not found.' })
    if (!String(item_title || '').trim() || !ITEM_TYPES.includes(item_type)) return res.status(422).json({ status: false, message: 'Provide a checklist item title and type.' })
    if (owner_user_id) {
      const owner = await User.findOne({ where: { user_id: owner_user_id, organization_id: req.user.organization_id, is_deleted: 0, is_blocked: 0 } })
      if (!owner) return res.status(422).json({ status: false, message: 'Select an active user from your organisation.' })
    }
    const item = await AcquittalItem.create({ organization_grant_id: grant.organization_grant_id, item_title: item_title.trim(), item_type, is_required: is_required !== false, owner_user_id: owner_user_id || null, due_date: due_date || grant.acquittal_date || null, evidence_note: evidence_note || null })
    return res.json({ status: true, message: 'Checklist item added.', data: { item } })
  }

  const item = await AcquittalItem.findOne({
    where: { acquittal_item_id, is_deleted: 0 },
    include: [{ model: Grant, as: 'grant', where: { organization_id: req.user.organization_id, is_deleted: 0 }, required: true }],
  })
  if (!item) return res.status(404).json({ status: false, message: 'Checklist item not found.' })

  if (action === 'remove') {
    if (!isAdmin) return res.status(403).json({ status: false, message: 'Only an Organisation Admin can remove checklist items.' })
    await item.update({ is_deleted: 1, modified_at: new Date() })
    return res.json({ status: true, message: 'Checklist item removed.' })
  }

  if (!isAdmin && Number(item.owner_user_id) !== Number(req.user.user_id)) {
    return res.status(403).json({ status: false, message: 'You can only update checklist items assigned to you.' })
  }
  if (status !== undefined && !ITEM_STATUSES.includes(status)) return res.status(422).json({ status: false, message: 'Select a valid checklist status.' })
  if (!isAdmin && (item_title !== undefined || item_type !== undefined || owner_user_id !== undefined || due_date !== undefined || is_required !== undefined)) {
    return res.status(403).json({ status: false, message: 'Only an Organisation Admin can change checklist ownership or requirements.' })
  }
  if (item_type !== undefined && !ITEM_TYPES.includes(item_type)) return res.status(422).json({ status: false, message: 'Select a valid checklist type.' })
  if (owner_user_id) {
    const owner = await User.findOne({ where: { user_id: owner_user_id, organization_id: req.user.organization_id, is_deleted: 0, is_blocked: 0 } })
    if (!owner) return res.status(422).json({ status: false, message: 'Select an active user from your organisation.' })
  }

  const update = {
    ...(isAdmin && item_title !== undefined ? { item_title: String(item_title || '').trim() } : {}),
    ...(isAdmin && item_type !== undefined ? { item_type } : {}),
    ...(isAdmin && is_required !== undefined ? { is_required: Boolean(is_required) } : {}),
    ...(isAdmin && owner_user_id !== undefined ? { owner_user_id: owner_user_id || null } : {}),
    ...(isAdmin && due_date !== undefined ? { due_date: due_date || null } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(evidence_note !== undefined ? { evidence_note: String(evidence_note || '').trim() || null } : {}),
    modified_at: new Date(),
  }
  if (status === 'complete') update.completed_at = new Date()
  if (status && status !== 'complete') update.completed_at = null
  await item.update(update)
  res.json({ status: true, message: 'Checklist item updated.', data: { item } })
})
