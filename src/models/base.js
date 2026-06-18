import Sequelize from 'sequelize'
import dbConfig from '../../config/dbConnection.json' with {type:"json"}

import UserModel from '../models/userModel.js'
import UserRoleModel from './userRoleModel.js'
import OrganizationModel from './organizationModel.js'
import OrganizationDepartmentModel from './organizationDepartmentModel.js'
import MasterDataModel from './masterDataModel.js'
import CountryModel from './countryModel.js'
import StateModel from './stateModel.js'
import GrantModel from './grantModel.js'
import RelatedProjectsModel from './relatedProjectsModel.js'
import RelatedCommunityModel from './relatedCommunityModel.js'
import RelatedOfficersModel from './relatedOfficersModel.js'
import RelatedClubModel from './relatedClubModel.js'
import RelatedExpenseModel from './relatedExpenseModel.js'
import RelatedReportModel from './relatedReportsModel.js'
import RelatedNotesModel from './relatedNotesModel.js'
import RelatedFileModel from './relatedFilesModel.js'
import TaskModel from './taskModel.js'
import SubscriptionPlansModel from './subscriptionPlans.js'
import SupportTicketModel from './supportTicketModel.js'
import GrantCategoryModel from './grantCategoryModel.js'
import SystemSettingsModel from './systemSettingsModel.js'

//declear params
const Op = Sequelize.Op
const seq = Sequelize

//connect to the database
const sequelize = new Sequelize(
  dbConfig.databaseName,
  dbConfig.databaseUser,
  dbConfig.databasePass,
  {
    host: 'localhost',
    dialect: 'mysql',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
)

//db creations
sequelize.sync({ force: false }).then(() => {
  console.log('Database and table created if not created')
})

//start model declarations with DB connection
const User = UserModel(sequelize, Sequelize)
const UserRole = UserRoleModel(sequelize, Sequelize)
const Organization = OrganizationModel(sequelize, Sequelize)
const OrganizationDepartment = OrganizationDepartmentModel(sequelize, Sequelize)
const MasterData = MasterDataModel(sequelize, Sequelize)
const Country = CountryModel(sequelize, Sequelize)
const States = StateModel(sequelize, Sequelize)
const Grant = GrantModel(sequelize, Sequelize)
const GrantProjects = RelatedProjectsModel(sequelize, Sequelize)
const GrantOfficers = RelatedOfficersModel(sequelize, Sequelize)
const GrantClubs = RelatedClubModel(sequelize, Sequelize)
const GrantCommunities = RelatedCommunityModel(sequelize, Sequelize)
const GrantItemExpenses = RelatedExpenseModel(sequelize, Sequelize)
const GrantReports = RelatedReportModel(sequelize, Sequelize)
const GrantNotes = RelatedNotesModel(sequelize, Sequelize)
const GrantFiles = RelatedFileModel(sequelize, Sequelize)
const Task = TaskModel(sequelize, Sequelize)
const SubscriptionPlans = SubscriptionPlansModel(sequelize, Sequelize)
const SupportTickets = SupportTicketModel(sequelize, Sequelize)
const GrantCategory = GrantCategoryModel(sequelize, Sequelize)
const SystemSettings = SystemSettingsModel(sequelize, Sequelize)

User.belongsTo(UserRole, { foreignKey: 'user_type', as: 'user_role' })
User.hasOne(Country, { foreignKey: 'country_id', as: 'country' })
User.belongsTo(MasterData, { foreignKey: 'position_id', as: 'position' })
User.belongsTo(Organization, {
  foreignKey: 'organization_id',
  as: 'organization',
})
User.hasOne(OrganizationDepartment, {
  foreignKey: 'organization_dept_id',
  as: 'organization_dept',
})
Grant.belongsTo(GrantCategory, { foreignKey: 'category_id', as: 'category' })
Grant.hasMany(GrantProjects, {
  as: 'projects',
  foreignKey: 'organization_grant_id',
})
Grant.hasMany(GrantOfficers, {
  as: 'officers',
  foreignKey: 'organization_grant_id',
})
Grant.hasMany(GrantClubs, { as: 'clubs', foreignKey: 'organization_grant_id' })
Grant.hasMany(GrantCommunities, {
  as: 'communities',
  foreignKey: 'organization_grant_id',
})
Grant.hasMany(GrantItemExpenses, {
  as: 'item_expenses',
  foreignKey: 'organization_grant_id',
})
Grant.hasMany(GrantReports, {
  as: 'reports',
  foreignKey: 'organization_grant_id',
})
Grant.hasMany(GrantNotes, { as: 'notes', foreignKey: 'organization_grant_id' })
Grant.hasMany(Task, { as: 'tasks', foreignKey: 'organization_grant_id' })
Task.belongsTo(Grant, { foreignKey: 'organization_grant_id', as: 'grant' })
Task.belongsTo(User, { foreignKey: 'task_assigned_to', as: 'assigned_member' })
User.hasMany(Task, { as: 'usertasklist', foreignKey: 'user_id' })
GrantItemExpenses.belongsTo(User, {
  foreignKey: 'expense_paid_by',
  as: 'paid_by',
})
GrantReports.hasMany(GrantFiles, {
  as: 'report_files',
  foreignKey: 'related_report_id',
})
SupportTickets.belongsTo(Organization, {
  foreignKey: 'organization_id',
  as: 'ticked_raised_by_organization',
})

export default {
  Op,
  seq,
  SystemSettings,
  User,
  UserRole,
  Organization,
  MasterData,
  Country,
  States,
  GrantCategory,
  Grant,
  GrantProjects,
  GrantOfficers,
  GrantClubs,
  GrantCommunities,
  GrantItemExpenses,
  GrantReports,
  GrantNotes,
  GrantFiles,
  Task,
  SubscriptionPlans,
  SupportTickets,
}
