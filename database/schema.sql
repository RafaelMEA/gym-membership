-- database/schema.sql
-- Gym Membership System — MariaDB 10.4 / MySQL 8 compatible
-- Portable SQL: no utf8mb4_0900_ai_ci (MySQL-8 only collation)

CREATE DATABASE IF NOT EXISTS gym_membership
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gym_membership;

-- ─────────────────────────────────────────────────────────────
-- 1. STAFF — the only table with credentials.
--    Separate from members so a 'role' field can never be
--    mass-assigned by a request body. See Phase 6.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE auth_staff (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(120)  NOT NULL,
  email          VARCHAR(190)  NOT NULL,
  password_hash  VARCHAR(255)  NOT NULL,
  role           ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  last_login_at  DATETIME      NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_staff_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 2. MEMBERS — gym customers. No password column by design.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE members (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- Generated from id: race-free (no two members can collide),
  -- unlike assigning a code in application code before INSERT.
  membership_no VARCHAR(20) NOT NULL,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  email         VARCHAR(190) NOT NULL,
  phone         VARCHAR(30)  NULL,
  date_of_birth DATE         NULL,
  gender        ENUM('male','female','other','undisclosed')
                            NOT NULL DEFAULT 'undisclosed',
  emergency_contact_name  VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(30)  NULL,
  notes         TEXT         NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_members_no     (membership_no),
  UNIQUE KEY uq_members_email  (email),
  KEY idx_members_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 3. MEMBERSHIP_PLANS — what's on sale.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE membership_plans (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(80)   NOT NULL,
  description     VARCHAR(255)  NULL,
  price           DECIMAL(10,2) NOT NULL,
  -- Duration as value + unit. A months-only column cannot
  -- express a Day Pass, and 0 was ambiguous ('unlimited' vs
  -- 'zero days'). NULL duration = unlimited lifetime access.
  duration_value TINYINT UNSIGNED NOT NULL DEFAULT 1,
  duration_unit  ENUM('day','week','month','year')
                 NOT NULL DEFAULT 'month',
  -- Included visits; NULL = unlimited.
  max_visits_per_period INT UNSIGNED NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_plans_name (name),
  CHECK (price >= 0),
  CHECK (duration_value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 4. SUBSCRIPTIONS — one row per membership PERIOD.
--    Not columns on members: history is real business data.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id           INT UNSIGNED NOT NULL,
  plan_id             INT UNSIGNED NOT NULL,
  start_date          DATE NOT NULL,
  -- The NATURAL expiry (end of paid term). Always known,
  -- even if cancelled early — that's the original promise.
  end_date            DATE NOT NULL,
  -- 'active' | 'cancelled' | 'frozen'. Deliberately NO
  -- 'expired' — expiry is derived from end_date, so it can
  -- never go stale waiting on a cron job.
  status              ENUM('active','cancelled','frozen')
                      NOT NULL DEFAULT 'active',
  cancelled_at        DATETIME NULL,
  cancellation_reason VARCHAR(255) NULL,
  frozen_until        DATE NULL,
  auto_renew          TINYINT(1) NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,

  -- RESTRICT: never silently delete a member's billing
  -- history. You must consciously archive instead.
  CONSTRAINT fk_sub_member FOREIGN KEY (member_id)
    REFERENCES members(id)      ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id)
    REFERENCES membership_plans(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  KEY idx_sub_member (member_id),
  KEY idx_sub_dates  (start_date, end_date),
  KEY idx_sub_status (status, end_date),
  -- Half-open interval [start_date, end_date): the END IS
  -- EXCLUSIVE. A Day Pass is start=2026-09-20, end=2026-09-21
  -- — exactly one day, not zero.
  -- Never test "still active" with end_date >= CURDATE();
  -- that would treat today as still valid.
  CHECK (end_date > start_date),
  -- A cancellation must explain itself.
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 5. PAYMENTS — money received. All DECIMAL, never FLOAT.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT UNSIGNED NOT NULL,
  -- Unique, human-readable. This is the reconciliation key
  -- when a bank statement doesn't match our records.
  reference_no    VARCHAR(40) NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  method          ENUM('cash','card','transfer','online')
                  NOT NULL DEFAULT 'cash',
  status          ENUM('paid','pending','failed','refunded')
                  NOT NULL DEFAULT 'paid',
  paid_at         DATETIME NULL,
  notes           VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pay_sub FOREIGN KEY (subscription_id)
    REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  UNIQUE KEY uq_pay_ref  (reference_no),
  KEY idx_pay_sub  (subscription_id),
  KEY idx_pay_date (paid_at),
  -- Revenue reporting filters on status + date constantly.
  KEY idx_pay_status_date (status, paid_at),
  CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 6. ATTENDANCE — one row per gym visit.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE attendance (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   INT UNSIGNED NOT NULL,
  check_in    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out   DATETIME NULL,

  CONSTRAINT fk_att_member FOREIGN KEY (member_id)
    REFERENCES members(id) ON DELETE CASCADE ON UPDATE CASCADE,

  -- Composite, and deliberately (member_id, check_in) not the
  -- reverse: every query is "this member's history, newest
  -- first" — so member_id leads, check_in sorts.
  KEY idx_att_member_in (member_id, check_in),
  CHECK (check_out IS NULL OR check_out >= check_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- VIEW: the single source of truth for "is this member active?"
-- Every part of the app asks this view — never re-derive the
-- rule in 5 different places.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT
  s.id            AS subscription_id,
  s.member_id,
  s.plan_id,
  p.name          AS plan_name,
  s.start_date,
  s.end_date,
  DATEDIFF(s.end_date, CURDATE()) AS days_remaining
FROM subscriptions s
JOIN membership_plans p ON p.id = s.plan_id
WHERE s.status = 'active'
  AND s.start_date <= CURDATE()
  AND s.end_date   >  CURDATE();
-- ─────────────────────────────────────────────────────────────
-- Membership numbers: a counter table + BEFORE INSERT trigger.
-- Why not a GENERATED column? MySQL/MariaDB cannot reference an
-- AUTO_INCREMENT column there — ERROR 1901. Why not an AFTER
-- INSERT trigger that UPDATEs the row? ERROR 1442 — a trigger
-- may not modify the table that invoked it.
-- BEFORE INSERT runs before the row exists, so SET NEW works.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE membership_number_seq (
  next_value INT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

INSERT INTO membership_number_seq (next_value) VALUES (1);

DELIMITER //
CREATE TRIGGER trg_members_assign_no
BEFORE INSERT ON members
FOR EACH ROW
BEGIN
  UPDATE membership_number_seq
    SET next_value = LAST_INSERT_ID(next_value + 1);
  SET NEW.membership_no =
    CONCAT('GYM-', LPAD(LAST_INSERT_ID() - 1, 5, '0'));
END//
DELIMITER ;
