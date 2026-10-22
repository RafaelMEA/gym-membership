-- 001_add_frozen_at.sql
--
-- Why: when a subscription is unfrozen, end_date must be pushed
-- back by the number of days the membership was frozen — otherwise
-- a 2-week freeze silently costs the member 2 weeks of access.
--
-- frozen_until tells us WHEN the freeze ENDS. It does not tell us
-- WHEN the freeze STARTED, so we cannot compute the frozen duration
-- without a second timestamp.
--
-- Safe to run more than once.
--
--   mysql -u root gym_membership < database/migrations/001_add_frozen_at.sql

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'subscriptions'
    AND COLUMN_NAME  = 'frozen_at'
);

SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE subscriptions ADD COLUMN frozen_at DATETIME NULL AFTER cancellation_reason',
  'SELECT ''frozen_at already exists — nothing to do'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
