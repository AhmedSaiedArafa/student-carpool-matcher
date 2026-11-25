ALTER TABLE ride_templates ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(10) NOT NULL DEFAULT 'weekly' CHECK (schedule_type IN ('once','weekly'));
ALTER TABLE ride_templates ADD COLUMN IF NOT EXISTS weekdays SMALLINT[];
ALTER TABLE ride_templates ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE ride_templates ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE ride_templates SET weekdays = ARRAY[weekday] WHERE weekdays IS NULL;
UPDATE ride_templates SET start_date = created_at::date WHERE start_date IS NULL;
