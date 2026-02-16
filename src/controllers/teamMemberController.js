import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
const { Op, User, UserRole, MasterData, Grant, Task } = base
import CommonHelper from '../utils/commonHelper.js'
import sendEmail from '../utils/mailHelper.js'

/**
 * @description Add a new team member
 * @route POST /admin/member-add
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing team member details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and newly created team member details
 */
export const addTeamMember = asyncHandler(async (req, res, next) => {
  const {
    first_name,
    last_name,
    address,
    email,
    position_text,
    position_id,
    member_type,
  } = req.body
  const usr = await User.findOne({ where: { email: email } })
  if (usr) {
    return res.send({
      status: false,
      message: 'Email already exist.',
    })
  }

  const password = await CommonHelper.generatePassword()
  const usrObj = {
    email,
    password,
    first_name,
    middle_name: '',
    last_name,
    address,
    phone_no: '',
    user_type: member_type,
    organization_id: req.user.organization_id,
    position_text,
    created_at: new Date(),
    modified_at: new Date(),
  }
  if (position_id) {
    usrObj.position_id = position_id
  }
  if ( new Date() > new Date(req.user.subscription_expiry_date) ) {
    usrObj.subscription_status = false
  } else {
    usrObj.subscription_status = true
    usrObj.subscription_expiry_date = req.user.subscription_expiry_date
  }
  const member = await User.create(usrObj)
  sendEmail(
    member?.email,
    'Account creation Mail',
    'teamMember',
    {
      email: member?.email,
      password: password,
    },
    null // Attachments (optional)
  )

  const memberInfo = await User.findOne({
    attributes: [
      'user_id',
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'address',
      'position_text',
      'profile_image',
    ],
    where: { user_id: member.user_id },
    include: [
      {
        model: MasterData,
        as: 'position',
        attributes: ['masterdata_id', 'name'],
        required: false,
      },
      {
        model: UserRole,
        as: 'user_role',
        attributes: ['role_id', 'name'],
        required: false,
      },
    ],
    required: false,
    order: [['user_id', 'DESC']],
  })
  const imagePath = req.protocol + '://' + req.get('host') + '/uploads/'
  const memberDetails = {
    user_id: memberInfo.user_id,
    email: memberInfo.email,
    full_name: memberInfo.first_name + ' ' + memberInfo.last_name,
    address: memberInfo.address,
    position: memberInfo.position ? memberInfo.position.name : '',
    position_text: memberInfo.position_text ? memberInfo.position_text : '',
    user_role_id: memberInfo.user_role.role_id,
    user_type: memberInfo.user_role.name,
    profile_image: memberInfo.profile_image
      ? imagePath + 'profile_image/' + memberInfo.profile_image
      : '',
    rate: 55,
  }

  res.send({
    status: true,
    message: 'Team member added successfully.',
    data: { member: memberDetails, password },
  })
})

/**
 * @description Update an existing team member's details
 * @route POST /admin/member-update/:member_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.member_id - ID of the team member to update
 * @param {Object} req.body - Request body containing updated details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const updateTeamMember = asyncHandler(async (req, res, next) => {
  const memberId = req.params.member_id
  const {
    first_name,
    last_name,
    email,
    address,
    phone_no,
    member_type,
    position_text,
  } = req.body
  if (email) {
    var check = await User.findOne({
      where: { user_id: { [Op.ne]: memberId }, email: email },
    })
    // console.log(check)
    if (check) {
      return res.send({
        status: false,
        message: 'Email already exist',
      })
    }
  }
  await User.update(
    {
      first_name,
      last_name,
      email,
      address,
      phone_no,
      user_type: member_type,
      // position_id: (position_id) ? position_id : check.position_id,
      position_text,
    },
    { where: { user_id: memberId } }
  )
  res.send({
    status: true,
    message: 'Team member updated successfully.',
    data: {},
  })
})

/**
 * @description Remove a team member by marking them as deleted
 * @route DELETE /admin/member-remove/:member_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.member_id - ID of the team member to remove
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const removeTeamMember = asyncHandler(async (req, res, next) => {
  const memberId = req.params.member_id
  await User.update(
    {
      is_deleted: 1,
      deleted_at: new Date(),
    },
    {
      where: { user_id: memberId },
    }
  )
  res.send({
    status: true,
    message: 'Team member removed successfully',
    data: {},
  })
})

/**
 * @description Fetch a list of all team members in the organization
 * @route GET /admin/member-list
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and list of team members
 */
export const fetchMemberList = asyncHandler(async (req, res, next) => {
  const organizationId = req.user.organization_id
  // const userId = req.user.user_id
  // const userType = req.user.user_type
  const memberFindCond = { is_deleted: 0, organization_id: organizationId }
  memberFindCond.user_type = {
    [Op.in]: [3, 4],
  }

  const userList = await User.findAll({
    attributes: [
      'user_id',
      'first_name',
      'middle_name',
      'last_name',
      'email',
      'address',
      'position_text',
      'profile_image',
      'subscription_status'
    ],
    where: memberFindCond,
    include: [
      {
        model: MasterData,
        as: 'position',
        attributes: ['masterdata_id', 'name'],
        required: false,
      },
      {
        model: UserRole,
        as: 'user_role',
        attributes: ['role_id', 'name'],
        required: false,
      },
    ],
    required: false,
    order: [['user_id', 'DESC']],
  })
  const imagePath = req.protocol + '://' + req.get('host') + '/uploads/'
  const memberList = userList.map((el) => {
    return {
      user_id: el.user_id,
      email: el.email,
      full_name: el.first_name + ' ' + el.middle_name + ' ' + el.last_name,
      address: el.address,
      position: el.position ? el.position.name : '',
      position_text: el.position_text ? el.position_text : '',
      user_role_id: el.user_role.role_id,
      user_type: el.user_role.name,
      profile_image: el.profile_image
        ? imagePath + 'profile_image/' + el.profile_image
        : '',
      rate: 55,
      subscription_status: el.subscription_status,
      subscription_status_display_text: (el.subscription_status === false) ? 'Inactive' : 'Active'
    }
  })
  res.send({
    status: true,
    message: 'List of Team members.',
    data: { memberList },
  })
})

/**
 * @description Get details of a specific team member
 * @route GET /admin/member-details/:member_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.member_id - ID of the team member
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and team member details
 */
export const getMemberDetails = asyncHandler(async (req, res, next) => {
  const memberId = req.params.member_id
  const organizationId = req.user.organization_id
  const data = await User.findOne({
    attributes: [
      'first_name',
      'last_name',
      'email',
      'address',
      'position_text',
      'user_type',
    ],
    where: { user_id: memberId, organization_id: organizationId },
    include: [
      {
        model: UserRole,
        as: 'user_role',
        attributes: ['role_id', 'name'],
        required: false,
      },
    ],
  })
  if (!data) {
    return res.send({
      status: false,
      message: 'no data found',
      data: {},
    })
  }
  let userDetails = {}
  userDetails.user_id = data.user_id
  userDetails.email = data.email
  userDetails.first_name = data.first_name
  userDetails.last_name = data.last_name
  userDetails.address = data.address
  userDetails.position_text = data.position_text ? data.position_text : ''
  ;(userDetails.user_role_id = data.user_role.role_id),
    (userDetails.user_type = data.user_role.name)

  res.send({
    status: true,
    message: 'Member details.',
    data: { userDetails },
  })
})

/**
 * @description Get information about a team member's tasks
 * @route GET /admin/member-view/:member_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.member_id - ID of the team member
 * @param {Object} res - Express response object
 * @returns {Object} Response with status, user info, and task list
 */
export const getMemberInfo = asyncHandler(async (req, res, next) => {
  const memberId = req.params.member_id
  const data = await Task.findAll({
    attributes: [
      'task_id',
      'task_status',
      'task_assigned_to',
      'task_start_date',
      'task_completion_date',
      'created_at',
    ],
    where: { task_assigned_to: memberId },
    include: [
      {
        model: Grant,
        as: 'grant',
        attributes: ['organization_grant_id', 'grant_title'],
        required: false,
      },
      {
        model: User,
        as: 'assigned_member',
        attributes: ['email', 'address', 'profile_image'],
        include: [
          {
            model: MasterData,
            as: 'position',
            attributes: ['masterdata_id', 'name'],
          },
          {
            model: UserRole,
            as: 'user_role',
            attributes: ['role_id', 'name'],
          },
        ],
        required: false,
      },
    ],
  })

  const userInfo = {
    email: data[0].assigned_member.email,
    address: data[0].assigned_member.address,
    position: data[0].assigned_member?.position?.name,
    user_type: data[0].assigned_member?.user_role?.name,
  }
  const taskList = data.map((el) => {
    return {
      task_id: el.task_id,
      grant_title: el.grant.grant_title,
      task_status: el.task_status,
      task_assigned_on: moment(new Date(el.created_at)).format('DD-MM-YYYY'),
      task_start_date: el.task_start_date
        ? moment(new Date(el.task_start_date)).format('DD-MM-YYYY')
        : '',
      task_completion_date: el.task_completion_date
        ? moment(new Date(el.task_completion_date)).format('DD-MM-YYYY')
        : '',
    }
  })
  res.send({
    status: true,
    message: 'Team member information.',
    data: { userInfo, taskList },
  })
})
