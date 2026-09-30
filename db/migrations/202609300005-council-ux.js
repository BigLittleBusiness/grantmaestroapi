import { addColumnIfMissing } from './helpers.js'

/** Grant workflow fields, the accountable officer link and acquittal items. */
export const up = async ({ connection }) => {
  const columns = [
    ['workflow_stage', "VARCHAR(32) NOT NULL DEFAULT 'opportunity' AFTER account_used_for_expenses"],
    ['next_action', 'TEXT NULL AFTER workflow_stage'],
    ['next_action_due_date', 'DATE NULL AFTER next_action'],
    ['accountable_user_id', 'INT UNSIGNED NULL AFTER next_action_due_date'],
    ['risk_status', "VARCHAR(32) NOT NULL DEFAULT 'on_track' AFTER accountable_user_id"],
    ['strategic_priority', 'VARCHAR(255) NULL AFTER risk_status'],
  ]
  for (const [column, definition] of columns) {
    await addColumnIfMissing(connection, 'grant_organization_grants', column, definition)
  }

  const [indexes] = await connection.query(
    "SHOW INDEX FROM grant_organization_grants WHERE Key_name = 'idx_grant_accountable_user'"
  )
  if (!indexes.length) {
    await connection.query('CREATE INDEX idx_grant_accountable_user ON grant_organization_grants (accountable_user_id)')
  }

  const [constraints] = await connection.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grant_organization_grants'
      AND COLUMN_NAME = 'accountable_user_id' AND REFERENCED_TABLE_NAME = 'grant_users'
  `)
  if (!constraints.length) {
    await connection.query(`
      ALTER TABLE grant_organization_grants
      ADD CONSTRAINT fk_grant_accountable_user
      FOREIGN KEY (accountable_user_id) REFERENCES grant_users(user_id) ON DELETE SET NULL
    `)
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS grant_acquittal_items (
      acquittal_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_grant_id INT UNSIGNED NOT NULL,
      item_title VARCHAR(255) NOT NULL,
      item_type ENUM('evidence', 'finance', 'approval', 'submission') NOT NULL DEFAULT 'evidence',
      is_required TINYINT(1) NOT NULL DEFAULT 1,
      status ENUM('not_started', 'in_progress', 'ready_for_review', 'complete', 'not_required') NOT NULL DEFAULT 'not_started',
      owner_user_id INT UNSIGNED NULL,
      due_date DATE NULL,
      evidence_note TEXT NULL,
      completed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (acquittal_item_id),
      KEY idx_acquittal_grant (organization_grant_id),
      KEY idx_acquittal_owner (owner_user_id),
      CONSTRAINT fk_acquittal_grant FOREIGN KEY (organization_grant_id)
        REFERENCES grant_organization_grants(organization_grant_id) ON DELETE CASCADE,
      CONSTRAINT fk_acquittal_owner FOREIGN KEY (owner_user_id)
        REFERENCES grant_users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await connection.query(`
    UPDATE grant_organization_grants
    SET workflow_stage = CASE
      WHEN outcome = 'won' AND acquittal_date IS NOT NULL THEN 'acquittal'
      WHEN outcome IS NOT NULL AND outcome <> '' THEN 'outcome'
      WHEN is_grant_submitted = 1 THEN 'submitted'
      WHEN determination IS NOT NULL AND determination <> '' THEN 'suitability'
      ELSE 'opportunity'
    END
    WHERE workflow_stage IS NULL OR workflow_stage = '' OR workflow_stage = 'opportunity'
  `)
}
