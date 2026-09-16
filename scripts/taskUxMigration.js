import '../src/env.js'
import mysql from 'mysql2/promise'

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

const ensureColumn = async (name, definition) => {
  const [rows] = await connection.query('SHOW COLUMNS FROM grant_tasks LIKE ?', [name])
  if (!rows.length) {
    await connection.query(`ALTER TABLE grant_tasks ADD COLUMN ${definition}`)
    console.log(`Added grant_tasks.${name}`)
  }
}

try {
  await connection.beginTransaction()
  await ensureColumn('task_priority', "task_priority ENUM('high','medium','low') NULL AFTER task_status")
  await ensureColumn('task_type', 'task_type VARCHAR(64) NULL AFTER task_priority')
  await ensureColumn('grant_stage', 'grant_stage VARCHAR(32) NULL AFTER task_type')
  await ensureColumn('estimated_effort_hours', 'estimated_effort_hours DECIMAL(6,2) NULL AFTER grant_stage')
  await ensureColumn('dependency_note', 'dependency_note TEXT NULL AFTER estimated_effort_hours')
  await ensureColumn('completion_evidence', 'completion_evidence TEXT NULL AFTER dependency_note')

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
  await connection.commit()
  console.log('Task UX migration completed successfully.')
} catch (error) {
  await connection.rollback()
  console.error('Task UX migration failed:', error.message)
  process.exitCode = 1
} finally {
  await connection.end()
}
