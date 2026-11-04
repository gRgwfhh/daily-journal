USE daily_journal;

ALTER TABLE sleep_records
  ADD COLUMN hours_slept DECIMAL(4,2) NULL AFTER sleep_date;

UPDATE sleep_records
SET hours_slept = ROUND(
  MOD(TIME_TO_SEC(wake_time) - TIME_TO_SEC(sleep_start) + 86400, 86400) / 3600,
  2
);

ALTER TABLE sleep_records
  DROP COLUMN sleep_start,
  DROP COLUMN wake_time,
  MODIFY COLUMN hours_slept DECIMAL(4,2) NOT NULL;
