import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'

const {
  Op,
  User,
  GrantCategory,
  Grant,
  GrantReports,
  GrantItemExpenses,
  GrantNotes,
  GrantFiles,
  Task,
} = base

/**
 * @description Add a new grant
 * @route POST /grant/grant-add
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing grant details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and newly created grant details
 */
export const addGrant = asyncHandler(async (req, res, next) => {
  const userId = req.user.user_id
  const organizationId = req.user.organization_id
  const {
    category_id,
    grant_title,
    closing_date,
    origination_url,
    fund_originator,
    max_fund_amount,
    funding_sought_amount,
    finding_note,
    opening_date,
    note_type,
  } = req.body

  const grantObj = {
    organization_id: organizationId,
    category_id,
    grant_title,
    origination_url,
    opening_date,
    closing_date,
    fund_originator,
    max_fund_amount,
    funding_sought_amount: funding_sought_amount || 0,
    opening_date,
    grant_added_by: userId,
    latest_finding_note: finding_note,
  }

  const grant = await Grant.create(grantObj)

  await GrantNotes.create({
    note: finding_note,
    note_type,
    organization_grant_id: grant.organization_grant_id,
  })

  res.send({
    status: true,
    message: 'Grant added successfully.',
    data: { grant },
  })
})

/**
 * @description Update an existing grant
 * @route POST /grant/grant-update/:grant_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.grant_id - ID of the grant to update
 * @param {Object} req.body - Request body containing updated grant details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and updated grant details
 */
export const updateGrant = asyncHandler(async (req, res, next) => {
  // console.log(req.files)
  const grantId = req.params.grant_id
  const {
    category_id,
    grant_title,
    origination_url,
    fund_originator,
    max_fund_amount,
    opening_date,
    funding_sought_amount,
    finding_note,
    decision_date,
    closing_date,
    assessment_outcome_date,
    determination,
    rationale_of_importance,
    sutability_note,
    grant_submission_date,
    submission_department,
    submission_department_representative,
    submission_project_name,
    submission_reasoning,
    submission_co_contributor,
    submission_note,
    outcome,
    outcome_date,
    agreement_signed,
    learning,
    outcome_note,
    report_title,
    report_submission_date,
    report_template_received,
    report_status,
    // related_projects,
    // related_communities,
    // related_clubs,
    // related_officers,
    // related_reports,
    won_fund_amount,
    received_fund_amount,
    total_amount_spent,
    account_used_for_expenses,
    financial_note,
  } = req.body
  // console.log(JSON.parse(related_projects))
  const grantInfo = await Grant.findOne({
    where: { organization_grant_id: grantId, is_deleted: 0 },
  })
  if (!grantInfo) {
    return res.send({
      status: false,
      message: 'Grant does not exist.',
      data: {},
    })
  }
  // console.log(grantInfo)
  await Grant.update(
    {
      category_id: category_id ? category_id : grantInfo.category_id,
      grant_title: grant_title ? grant_title : grantInfo.grant_title,
      origination_url: origination_url
        ? origination_url
        : grantInfo.origination_url,
      fund_originator: fund_originator
        ? fund_originator
        : grantInfo.fund_originator,
      max_fund_amount: max_fund_amount
        ? max_fund_amount
        : grantInfo.max_fund_amount,
      opening_date: opening_date ? opening_date : grantInfo.opening_date,
      funding_sought_amount: funding_sought_amount
        ? funding_sought_amount
        : grantInfo.funding_sought_amount,
      latest_finding_note: finding_note
        ? finding_note
        : grantInfo.latest_finding_note,
      decision_date: decision_date ? decision_date : grantInfo.decision_date,
      closing_date: closing_date ? closing_date : grantInfo.closing_date,
      opening_date: opening_date ? opening_date : grantInfo.opening_date,
      determination: determination ? determination : grantInfo.determination,
      rationale_of_importance: rationale_of_importance
        ? rationale_of_importance
        : grantInfo.rationale_of_importance,
      assessment_outcome_date: assessment_outcome_date
        ? assessment_outcome_date
        : null,
      latest_suitability_note: sutability_note
        ? sutability_note
        : grantInfo.latest_suitability_note,
      grant_submission_date: grant_submission_date
        ? grant_submission_date
        : grantInfo.grant_submission_date,
      submission_department: submission_department
        ? submission_department
        : grantInfo.submission_department,
      submission_department_representative: submission_department_representative
        ? submission_department_representative
        : grantInfo.submission_department_representative,
      submission_project_name: submission_project_name
        ? submission_project_name
        : grantInfo.submission_project_name,
      submission_reasoning: submission_reasoning
        ? submission_reasoning
        : grantInfo.submission_reasoning,
      submission_co_contributor: submission_co_contributor
        ? submission_co_contributor
        : grantInfo.submission_co_contributor,
      latest_submission_note: submission_note
        ? submission_note
        : grantInfo.latest_submission_note,
      outcome: outcome ? outcome : grantInfo.outcome,
      outcome_date: outcome_date ? outcome_date : grantInfo.outcome_date,
      agreement_signed: agreement_signed
        ? agreement_signed
        : grantInfo.agreement_signed,
      learning: learning ? learning : grantInfo.learning,
      latest_outcome_note: outcome_note
        ? outcome_note
        : grantInfo.latest_outcome_note,
      won_fund_amount: won_fund_amount
        ? won_fund_amount
        : grantInfo.won_fund_amount,
      received_fund_amount: received_fund_amount
        ? received_fund_amount
        : grantInfo.received_fund_amount,
      total_amount_spent: total_amount_spent
        ? total_amount_spent
        : grantInfo.total_amount_spent,
      remaining_fund_amount:
        received_fund_amount || total_amount_spent
          ? received_fund_amount - total_amount_spent
          : grantInfo.remaining_fund_amount,
      account_used_for_expenses: account_used_for_expenses
        ? account_used_for_expenses
        : grantInfo.account_used_for_expenses,
      latest_financial_note: financial_note
        ? financial_note
        : grantInfo.latest_financial_note,
    },
    {
      where: { organization_grant_id: grantId },
    }
  )
  //update notes table
  let notes = []
  if (finding_note) {
    notes.push({
      note_type: 1,
      note: finding_note,
      organization_grant_id: grantId,
    })
  }
  if (sutability_note) {
    notes.push({
      note_type: 2,
      note: sutability_note,
      organization_grant_id: grantId,
    })
  }
  if (submission_note) {
    notes.push({
      note_type: 3,
      note: submission_note,
      organization_grant_id: grantId,
    })
  }
  if (outcome_note) {
    notes.push({
      note_type: 4,
      note: outcome_note,
      organization_grant_id: grantId,
    })
  }
  if (financial_note) {
    notes.push({
      note_type: 6,
      note: financial_note,
      organization_grant_id: grantId,
    })
  }
  await GrantNotes.bulkCreate(notes)
  // insert related projects
  // if (related_projects && related_projects.length > 0) {
  //   const projects = JSON.parse(related_projects).map((el) => {
  //     return {
  //       project_name: el.name,
  //       project_description: el.deascription,
  //       organization_grant_id: grantId,
  //     }
  //   })
  //   // console.log(projects)
  //   await GrantProjects.bulkCreate(projects)
  // }

  // insert related communities
  // if (related_communities && related_communities.length > 0) {
  //   const communities = JSON.parse(related_communities).map((el) => {
  //     return {
  //       community_name: el.name,
  //       organization_grant_id: grantId,
  //     }
  //   })
  //   await GrantCommunities.bulkCreate(communities)
  // }

  // insert related officers
  // if (related_officers && related_officers.length > 0) {
  //   const officers = JSON.parse(related_officers).map((el) => {
  //     return {
  //       officer_name: el.name,
  //       organization_grant_id: grantId,
  //     }
  //   })
  //   await GrantOfficers.bulkCreate(officers)
  // }

  // insert related clubs
  // if (related_clubs && related_clubs.length > 0) {
  //   const clubs = JSON.parse(related_clubs).map((el) => {
  //     return {
  //       club_name: el.name,
  //       organization_grant_id: grantId,
  //     }
  //   })
  //   await GrantClubs.bulkCreate(clubs)
  // }

  // related reports
  // if (related_reports && related_reports.length > 0) {
  //   const reports = JSON.parse(related_reports).map((el) => {
  //     return {
  //       report_title: el.report_title,
  //       report_status: el.report_status,
  //       report_submission_date: new Date(),
  //       report_template_received: el.report_template_received,
  //       report_template_file_path: el.report_template_file_path,
  //       organization_grant_id: grantId,
  //     }
  //   })
  //   await GrantReports.bulkCreate(reports)
  // }
  if (report_title && report_submission_date) {
    const reportObj = {}
    reportObj.report_title = report_title
    reportObj.report_submission_date = report_submission_date
    reportObj.report_status = report_status
    reportObj.report_template_received = report_template_received
    reportObj.organization_grant_id = grantId
    if (req.files) {
      if (req.files.report_template_file) {
        reportObj.report_template_file_path =
          req.files.report_template_file[0].filename
      }
    }
    await GrantReports.create(reportObj)
  }

  //send grant details information for updating geant in state

  const updatedGrantInfo = await Grant.findOne({
    where: { organization_grant_id: grantId },
    include: [
      {
        model: GrantReports,
        as: 'reports',
        attributes: [
          'report_id',
          'report_title',
          'report_submission_date',
          'report_status',
          'report_template_received',
          'report_template_file_path',
        ],
        required: false,
      },
      {
        model: GrantItemExpenses,
        as: 'item_expenses',
        attributes: [
          'expense_id',
          'expense_description',
          'expense_amount',
          'expense_date',
        ],
        required: false,
      },
    ],
  })

  res.send({
    status: true,
    message: 'Grant updated successfully.',
    data: { grantInfo: updatedGrantInfo },
  })
})

/**
 * @description Manage a grant report (add or update)
 * @route POST /grant/grant-report-manage
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing report details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and report details
 */
export const manageGrantReport = asyncHandler(async (req, res, next) => {
  const {
    report_id,
    report_title,
    report_submission_date,
    report_status,
    report_template_received,
    grant_id,
  } = req.body
  const imagePath = req.protocol + '://' + req.get('host') + '/uploads/'
  const reportObj = {
    report_title,
    report_submission_date,
    report_template_received,
    report_status,
    organization_grant_id: grant_id,
  }
  if (req.files) {
    if (req.files.report_template_file) {
      reportObj.report_template_file_path =
        imagePath + 'file_vault/' + req.files.report_template_file[0].filename
    }
  }
  let reportId
  let message = 'Grant report added successfully.'
  if (report_id) {
    await GrantReports.update(reportObj, {
      where: { report_id: report_id },
    })

    reportId = report_id
    message = 'Grant report updated successfully.'
  } else {
    const reportInfo = await GrantReports.create(reportObj)
    reportId = reportInfo.report_id
  }
  if (req.files) {
    if (req.files.report_file) {
      const reportFilePath = req.files.report_file[0].filename
      await GrantFiles.create({
        file_path: imagePath + 'file_vault/' + reportFilePath,
        organization_grant_id: grant_id,
        related_report_id: reportId,
      })
    }
  }
  const reportDetails = await GrantReports.findOne({
    attributes: [
      'report_id',
      'report_title',
      'report_submission_date',
      'report_status',
      'report_template_received',
      'report_template_file_path',
      'organization_grant_id',
    ],
    where: { report_id: reportId },
    include: [
      {
        model: GrantFiles,
        as: 'report_files',
        attributes: [
          'related_file_id',
          'file_path',
          'organization_grant_id',
          'related_report_id',
        ],
        required: false,
      },
    ],
  })
  // console.log(reportDetails)
  res.send({
    status: true,
    message,
    data: { grant_report: reportDetails },
  })
})

/**
 * @description Remove a grant report
 * @route DELETE /grant/grant-report-remove/:report_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.report_id - ID of the report to remove
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and removed report details
 */
export const removeReportItem = asyncHandler(async (req, res, next) => {
  const reportId = req.params.report_id

  const reportInfo = await GrantReports.findOne({
    where: { report_id: reportId },
  })
  if (!reportInfo) {
    return res.send({
      status: false,
      message: 'Report item does not exist',
    })
  }

  await GrantReports.destroy({
    where: { report_id: reportId },
  })

  res.send({
    status: true,
    message: 'Report item removed successfully',
    data: { report: reportInfo },
  })
})

/**
 * @description Manage a grant expense (add or update)
 * @route POST /grant/grant-expense-manage
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing expense details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and expense details
 */
export const manageGrantExpense = asyncHandler(async (req, res, next) => {
  const {
    expense_id,
    grant_id,
    expense_description,
    expense_amount,
    expense_date,
    expense_payee,
    expense_paid_by,
  } = req.body
  const expenseObj = {
    expense_description,
    expense_amount,
    expense_date,
    expense_payee,
    expense_paid_by,
    organization_grant_id: grant_id,
  }
  let message = 'Grant expense added successfully.'
  let expenseId
  if (expense_id) {
    expenseId = expense_id
    await GrantItemExpenses.update(expenseObj, {
      where: { expense_id: expense_id },
    })
    message = 'Grant expense updated successfully.'
  } else {
    console.log('HELLOW', expenseObj)
    const createdExpense = await GrantItemExpenses.create(expenseObj)
    expenseId = createdExpense.expense_id
  }
  const expenseInfo = await GrantItemExpenses.findOne({
    where: { expense_id: expenseId },
    include: [
      {
        model: User,
        as: 'paid_by',
        attributes: ['user_id', 'first_name', 'last_name'],
        required: false,
      },
    ],
  })
  res.send({
    status: true,
    message,
    data: { expense: expenseInfo },
  })
})

/**
 * @description Remove a grant expense
 * @route DELETE /grant/grant-expense-remove/:expense_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.expense_id - ID of the expense to remove
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and removed expense details
 */
export const removeExpenseItem = asyncHandler(async (req, res, next) => {
  const expenseId = req.params.expense_id

  const expenseInfo = await GrantItemExpenses.findOne({
    where: { expense_id: expenseId },
  })
  if (!expenseInfo) {
    return res.send({
      status: false,
      message: 'Expense item does not exist',
    })
  }

  await GrantItemExpenses.destroy({
    where: { expense_id: expenseId },
  })

  res.send({
    status: true,
    message: 'Expense item removed successfully',
    data: { expense: expenseInfo },
  })
})

/**
 * @description Fetch the list of grants
 * @route GET /grant/grant-list
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters for filtering grants
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and list of grants
 */
export const grantList = asyncHandler(async (req, res, next) => {
  const organizationId = req.user.organization_id
  const userId = req.user.user_id
  const userType = req.user.user_type
  const grantFindCond = { organization_id: organizationId, is_deleted: false }
  //Find team member related grants
  if (userType == 3 || userType == 4) {
    const relatedTasks = await Task.findAll({
      attributes: ['task_id', 'organization_grant_id'],
      where: { task_assigned_to: userId },
    })
    const grantIds = relatedTasks.map((el) => {
      return el.organization_grant_id
    })
    grantFindCond.organization_grant_id = {
      [Op.in]: grantIds,
    }
  }
  console.log(req.query)
  if (req.query.grant_title) {
    grantFindCond.grant_title = {
      [Op.like]: `%${req.query.grant_title}%`,
    }
  }
  if (req.query.max_fund_amount) {
    grantFindCond.max_fund_amount = req.query.max_fund_amount
  }

  if (req.query.sought_amount) {
    grantFindCond.funding_sought_amount = req.query.sought_amount
  }

  if (req.query.opening_start && req.query.opening_end) {
    console.log(req.query.opening_start)
    grantFindCond.opening_date = {
      [Op.gte]: req.query.opening_start,
      [Op.lte]: req.query.opening_end,
    }
  }

  if (req.query.closing_start && req.query.closing_end) {
    grantFindCond.closing_date = {
      [Op.gte]: req.query.closing_start,
      [Op.lte]: req.query.closing_end,
    }
  }

  // if(req.query.closing_date){
  //   grantFindCond.closing_date = req.query.closing_date
  // }

  if (req.query.grant_status) {
    grantFindCond.grant_status = req.query.grant_status
  }

  if (req.query.outcome) {
    grantFindCond.outcome = {
      [Op.like]: `%${req.query.outcome}%`,
    }
  }

  const grantList = await Grant.findAll({
    where: grantFindCond,
    include: [
      {
        model: GrantCategory,
        as: 'category',
        attributes: ['grant_category_id', 'grant_category_name'],
        required: false,
      },
      {
        model: GrantReports,
        as: 'reports',
        attributes: [
          'report_id',
          'report_title',
          'report_submission_date',
          'report_status',
        ],
        required: false,
      },
    ],
    order: [['organization_grant_id', 'desc']],
  })

  const grants = grantList.map((el) => {
    return {
      organization_grant_id: el.organization_grant_id,
      category_id: el.category ? el.category.grant_category_id : '',
      category_name: el.category ? el.category.grant_category_name : '',
      grant_title: el.grant_title,
      origination_url: el.origination_url,
      max_fund_amount: el.max_fund_amount,
      funding_sought_amount: el.funding_sought_amount,
      fund_originator: el.fund_originator,
      notes1: el.latest_finding_note ? el.latest_finding_note : '',
      opening_date: el.opening_date,
      openingDate: el.opening_date,
      closingDate: el.closing_date,
      decisionDate: el.decision_date,
      determination: el.determination,
      rationale: el.rationale_of_importance,
      assessment_outcome_date: el.assessment_outcome_date,
      notes2: el.latest_suitability_note ? el.latest_suitability_note : '',
      submissionDate: el.grant_submission_date,
      submittedBy: el.grant_submitted_by,
      amountRequested: '',
      notes3: el.latest_submission_note ? el.latest_submission_note : '',
      outcome: el.outcome,
      decisionDate2: el.outcome_date,
      notes4: el.latest_outcome_note ? el.latest_outcome_note : '',
      reportTitle:
        el.reports && el.reports.length > 0 ? el.reports[0]?.report_title : '',
      reportSubmissionDate:
        el.reports && el.reports.length > 0
          ? el.reports[0]?.report_submission_date
          : '',
      reportStatus:
        el.reports && el.reports.length > 0 ? el.reports[0]?.report_status : '',
      reportNotes: '',
      allocatedFunds: el.won_fund_amount,
      spentAmount: el.total_amount_spent,
      remainingFunds: el.remaining_fund_amount,
      submission_department: el.submission_department,
      submission_department_representative:
        el.submission_department_representative,
      submission_project_name: el.submission_project_name,
      submission_reasoning: el.submission_reasoning,
      submission_co_contributor: el.submission_co_contributor,
      learning: el.learning,
      agreement_signed: el.agreement_signed,
      financialNotes: el.latest_financial_note ? el.latest_financial_note : '',
    }
  })
  res.send({
    status: true,
    message: 'Grant list',
    data: { grants },
  })
})

/**
 * @description Get details of a specific grant
 * @route GET /grant/grant-details/:grant_id
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.grant_id - ID of the grant
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and grant details
 */
export const getGrantDetails = asyncHandler(async (req, res, next) => {
  const grantId = req.params.grant_id
  const grantDetails = await Grant.findOne({
    where: { organization_grant_id: grantId },
    include: [
      {
        model: GrantCategory,
        as: 'category',
        attributes: ['grant_category_id', 'grant_category_name'],
        required: false,
      },
      {
        model: GrantReports,
        as: 'reports',
        attributes: [
          'report_id',
          'report_title',
          'report_submission_date',
          'report_status',
          'report_template_received',
          'report_template_file_path',
        ],
        include: [
          {
            model: GrantFiles,
            as: 'report_files',
            attributes: [
              'related_file_id',
              'file_path',
              'organization_grant_id',
              'related_report_id',
            ],
            required: false,
          },
        ],
        required: false,
      },
      {
        model: GrantItemExpenses,
        as: 'item_expenses',
        attributes: [
          'expense_id',
          'expense_description',
          'expense_amount',
          'expense_date',
          'expense_payee',
        ],
        include: [
          {
            model: User,
            as: 'paid_by',
            attributes: ['user_id', 'first_name', 'last_name'],
            required: false,
          },
        ],
        required: false,
      },
      {
        model: Task,
        as: 'tasks',
        attributes: [
          'task_id',
          'task_description',
          'task_status',
          'targeted_completion_date',
        ],

        required: false,
      },
    ],
  })
  const grantInfo = {
    organization_grant_id: grantDetails.organization_grant_id,
    category_id: grantDetails.category
      ? grantDetails.category.grant_category_id
      : '',
    category_name: grantDetails.category
      ? grantDetails.category.grant_category_name
      : '',
    grant_title: grantDetails.grant_title,
    origination_url: grantDetails.origination_url,
    max_fund_amount: grantDetails.max_fund_amount,
    funding_sought_amount: grantDetails.funding_sought_amount,
    fund_originator: grantDetails.fund_originator,
    latest_finding_note: grantDetails.latest_finding_note
      ? grantDetails.latest_finding_note
      : '',
    opening_date: grantDetails.opening_date,
    closing_date: grantDetails.closing_date,
    decision_date: grantDetails.decision_date,
    determination: grantDetails.determination,
    rationale_of_importance: grantDetails.rationale_of_importance,
    assessment_outcome_date: grantDetails.assessment_outcome_date,
    latest_suitability_note: grantDetails.latest_suitability_note
      ? grantDetails.latest_suitability_note
      : '',
    grant_submission_date: grantDetails.grant_submission_date,
    grant_submitted_by: grantDetails.grant_submitted_by,
    latest_submission_note: grantDetails.latest_submission_note
      ? grantDetails.latest_submission_note
      : '',
    amountRequested: '',
    outcome: grantDetails.outcome,
    outcome_date: grantDetails.outcome_date,
    latest_outcome_note: grantDetails.latest_outcome_note
      ? grantDetails.latest_outcome_note
      : '',
    allocatedFunds: grantDetails.won_fund_amount,
    spentAmount: grantDetails.total_amount_spent,
    remainingFunds: grantDetails.remaining_fund_amount,
    submission_department: grantDetails.submission_department,
    submission_department_representative:
      grantDetails.submission_department_representative,
    submission_project_name: grantDetails.submission_project_name,
    submission_reasoning: grantDetails.submission_reasoning,
    submission_co_contributor: grantDetails.submission_co_contributor,
    learning: grantDetails.learning,
    agreement_signed: grantDetails.agreement_signed,
    won_fund_amount: grantDetails.won_fund_amount,
    received_fund_amount: grantDetails.received_fund_amount,
    total_amount_spent: grantDetails.total_amount_spent,
    latest_financial_note: grantDetails.latest_financial_note,
    account_used_for_expenses: grantDetails.account_used_for_expenses,
    financialNotes: grantDetails.latest_financial_note
      ? grantDetails.latest_financial_note
      : '',
    latest_report_note: grantDetails.latest_report_note
      ? grantDetails.latest_report_note
      : '',
    reports:
      grantDetails.reports && grantDetails.reports.length > 0
        ? grantDetails.reports
        : [],
    item_expenses:
      grantDetails.item_expenses && grantDetails.item_expenses.length > 0
        ? grantDetails.item_expenses
        : [],
    tasks:
      grantDetails.tasks && grantDetails.tasks.length > 0
        ? grantDetails.tasks
        : [],
  }
  res.send({
    status: true,
    message: 'Grant information details',
    data: { grantInfo },
  })
})

/**
 * @description Manage a grant note (add or update)
 * @route POST /grant/grant-notes-manage
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing note details
 * @param {Object} res - Express response object
 * @returns {Object} Response with status and note details
 */
export const manageGrantNote = asyncHandler(async (req, res, next) => {
  const { note_id, note_type, note, grant_id } = req.body
  const noteObj = {
    note_type,
    note,
    organization_grant_id: grant_id,
  }
  let noteDetails = {}
  let msg = 'Notes added successfully'
  if (note_id) {
    await GrantNotes.update(noteObj, {
      where: { note_id: note_id },
    })
    noteDetails = await GrantNotes.findOne({
      where: { note_id: note_id },
    })
    msg = 'Notes updated successfully'
  } else {
    noteDetails = await GrantNotes.create(noteObj)
  }

  const grantobj = { organization_grant_id: grant_id }
  if (note_type == 1) {
    grantobj.latest_finding_note = note
  }
  if (note_type == 2) {
    grantobj.latest_suitability_note = note
  }
  if (note_type == 3) {
    grantobj.latest_submission_note = note
  }
  if (note_type == 4) {
    grantobj.latest_outcome_note = note
  }
  if (note_type == 5) {
    grantobj.latest_report_note = note
  }
  if (note_type == 6) {
    grantobj.latest_financial_note = note
  }
  await Grant.update(grantobj, { where: { organization_grant_id: grant_id } })
  res.send({
    status: true,
    message: msg,
    data: { note: noteDetails },
  })
})
