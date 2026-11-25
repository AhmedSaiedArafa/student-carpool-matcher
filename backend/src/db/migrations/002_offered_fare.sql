ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS offered_fare NUMERIC(6,2) CHECK (offered_fare IS NULL OR offered_fare >= 0);
