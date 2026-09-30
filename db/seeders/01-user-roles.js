// Role IDs are fixed by src/utils/routeAccessHelper.js (ROLE).
const ROLES = [
  [1, 'Organisation Admin'],
  [2, 'Platform Admin'],
  [3, 'Team Member'],
  [4, 'Acquittal Contributor'],
]

export const run = async ({ connection }) => {
  for (const [roleId, name] of ROLES) {
    await connection.query(
      `INSERT INTO grant_user_roles (role_id, name, is_blocked, is_deleted, created_at, modified_at)
       VALUES (?, ?, 0, 0, NOW(), NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), is_blocked = 0, is_deleted = 0, modified_at = NOW()`,
      [roleId, name]
    )
  }
  return `${ROLES.length} roles ensured`
}
