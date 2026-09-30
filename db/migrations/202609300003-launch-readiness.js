import { addColumnIfMissing } from './helpers.js'

export const up = async ({ connection }) => {
  // Historical public registrations used role 2. Only the dedicated
  // GrantMaestro Platform organisation may hold the Platform Admin role.
  await connection.query(`
    UPDATE grant_users u
    INNER JOIN grant_organizations o ON o.organization_id = u.organization_id
    SET u.user_type = 1, u.modified_at = NOW()
    WHERE u.user_type = 2 AND o.organization_name <> 'GrantMaestro Platform'
  `)
  await addColumnIfMissing(connection, 'grant_organization_grants', 'acquittal_date',
    'DATE NULL AFTER agreement_signed')
}
