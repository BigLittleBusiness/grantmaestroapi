import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'

const { Organization, SupportTickets } = base

/**
 * @description Fetch the list of support tickets
 * @route GET /ticket/ticket-list
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and list of tickets
 */
export const fetchTicketList = asyncHandler(async (req, res, next) => {
  const userType = req.user.user_type
  const organizationId = req.user.organization_id
  const findCond = { is_deleted: 0 }
  if (userType != 1) {
    findCond.organization_id = organizationId
  }
  const tickets = await SupportTickets.findAll({
    attributes: [
      'ticket_id',
      'ticket_title',
      'ticket_description',
      'ticket_file_path',
      'ticket_status',
      'organization_id',
    ],
    where: findCond,
    include: [
      {
        model: Organization,
        as: 'ticked_raised_by_organization',
        attributes: ['organization_name'],
        required: true,
      },
    ],
    order: [['ticket_id', 'desc']],
  })
  // console.log(tickets)
  res.send({
    status: true,
    message: 'Support ticket list',
    data: { tickets },
  })
})

/**
 * @description Get details of a specific support ticket
 * @route GET /ticket/ticket-detail/:ticket_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.ticket_id - ID of the ticket
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and ticket details
 */
export const getTicketDetail = asyncHandler(async (req, res, next) => {
  const ticketId = req.params.ticket_id

  const ticketInfo = await SupportTickets.findOne({
    attributes: [
      'ticket_id',
      'ticket_title',
      'ticket_description',
      'ticket_file_path',
      'ticket_status',
      'organization_id',
    ],
    where: { ticket_id: ticketId, is_deleted: 0 },
    include: [
      {
        model: Organization,
        as: 'ticked_raised_by_organization',
        attributes: ['organization_name'],
        required: true,
      },
    ],
  })
  if (!ticketInfo) {
    return res.send({
      status: false,
      message: 'Ticket does not exist',
    })
  }
  const ticketDetail = {}
  ticketDetail.ticket_id = ticketInfo.ticket_id
  ticketDetail.ticket_title = ticketInfo.ticket_title
  ticketDetail.ticket_description = ticketInfo.ticket_description
  ticketDetail.ticket_file_path = ticketInfo.ticket_file_path
  ticketDetail.ticket_status = ticketInfo.ticket_status
  ticketDetail.organization_id = ticketInfo.organization_id
  ticketDetail.organization_name =
    ticketInfo?.ticked_raised_by_organization?.organization_name

  res.send({
    status: true,
    message: 'Support ticket detail',
    data: { ticketDetail },
  })
})

/**
 * @description Create or update a support ticket
 * @route POST /ticket/ticket-manage
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing ticket details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and ticket details
 */
export const manageTicket = asyncHandler(async (req, res, next) => {
  const organizationId = req.user.organization_id
  const { ticket_id, ticket_title, ticket_description } = req.body
  let ticketObj = {
    ticket_title,
    ticket_description,
    organization_id: organizationId,
  }
  if (req.files) {
    if (req.files.support_ticket_file) {
      ticketObj.ticket_file_path = req.files.support_ticket_file[0].filename
    }
  }
  let msg = 'Ticket submitted successfully'
  let ticketId
  if (ticket_id) {
    //update data
    await SupportTickets.update(ticketObj, {
      where: { ticket_id: ticket_id },
    })
    ticketId = ticket_id
    msg = 'Ticket updated successfully'
  } else {
    //create data
    const createdTicket = await SupportTickets.create(ticketObj)
    ticketId = createdTicket.ticket_id
  }
  //get ticket information
  const ticketInfo = await SupportTickets.findOne({
    attributes: [
      'ticket_id',
      'ticket_title',
      'ticket_description',
      'ticket_file_path',
      'ticket_status',
      'organization_id',
    ],
    where: { ticket_id: ticketId },
    include: [
      {
        model: Organization,
        as: 'ticked_raised_by_organization',
        attributes: ['organization_name'],
        required: true,
      },
    ],
  })
  const imagePath = req.protocol + '://' + req.get('host') + '/uploads/'
  const ticketDetail = {}
  ticketDetail.ticket_id = ticketInfo.ticket_id
  ticketDetail.ticket_title = ticketInfo.ticket_title
  ticketDetail.ticket_description = ticketInfo.ticket_description
  ticketDetail.ticket_file_path = ticketInfo.ticket_file_path
    ? imagePath + 'support_ticket/' + ticketInfo.ticket_file_path
    : ''
  ticketDetail.ticket_status = ticketInfo.ticket_status
  ticketDetail.organization_id = ticketInfo.organization_id
  ticketDetail.organization_name =
    ticketInfo?.ticked_raised_by_organization?.organization_name

  res.send({
    status: true,
    message: msg,
    data: { ticketDetail },
  })
})

/**
 * @description Remove a support ticket by marking it as deleted
 * @route DELETE /ticket/ticket-remove/:ticket_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.ticket_id - ID of the ticket to remove
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const removeTicket = asyncHandler(async (req, res, next) => {
  const ticketId = req.params.ticket_id
  await SupportTickets.update(
    {
      is_deleted: 1,
      deleted_at: new Date(),
    },
    {
      where: { ticket_id: ticketId },
    }
  )
  res.send({
    status: true,
    message: 'Support ticket removed successfully',
    data: {},
  })
})

/**
 * @description Update the status of a support ticket
 * @route POST /ticket/ticket-status-update/:ticket_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.ticket_id - ID of the ticket to update
 * @param {Object} req.body - Request body containing the new status
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and success message
 */
export const updateTicketStatus = asyncHandler(async (req, res, next) => {
  const ticketId = req.params.ticket_id
  const { ticket_status } = req.body
  await SupportTickets.update(
    {
      ticket_status,
    },
    {
      where: { ticket_id: ticketId },
    }
  )
  //send mail to oganization admin for each status update
  res.send({
    status: true,
    message: 'Support ticket status updated successfully',
    data: {},
  })
})
