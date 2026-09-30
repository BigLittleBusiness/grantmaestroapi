import { addColumnIfMissing } from './helpers.js'

/** Task planning fields and the task checklist table. */
export const up = async ({ connection }) => {
  const columns = [
    ['task_priority', "ENUM('high','medium','low') NULL AFTER task_status"],
    ['task_type', 'VARCHAR(64) NULL AFTER task_priority'],
    ['grant_stage', 'VARCHAR(32) NULL AFTER task_type'],
    ['estimated_effort_hours', 'DECIMAL(6,2) NULL AFTER grant_stage'],
    ['dependency_note', 'TEXT NULL AFTER estimated_effort_hours'],
    ['completion_evidence', 'TEXT NULL AFTER dependency_note'],
  ]
  for (const [column, definition] of columns) {
    await addColumnIfMissing(connection, 'grant_tasks', column, definition)
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS grant_task_checklist_items (
      task_checklist_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      task_id INT UNSIGNED NOT NULL,
      item_text VARCHAR(500) NOT NULL,
      is_complete TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      completed_by_user_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (task_checklist_item_id),
      KEY idx_task_checklist_task (task_id),
      CONSTRAINT fk_task_checklist_task FOREIGN KEY (task_id) REFERENCES grant_tasks(task_id) ON DELETE CASCADE,
      CONSTRAINT fk_task_checklist_user FOREIGN KEY (completed_by_user_id) REFERENCES grant_users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}
