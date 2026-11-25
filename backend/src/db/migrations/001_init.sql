CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  university_email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'rider' CHECK (role IN ('driver', 'rider')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token VARCHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ride_templates (
  id              SERIAL PRIMARY KEY,
  driver_id       INT NOT NULL REFERENCES users(id),
  origin_lat      DOUBLE PRECISION NOT NULL,
  origin_lng      DOUBLE PRECISION NOT NULL,
  origin_name     VARCHAR(255),
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  destination_name VARCHAR(255),
  weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  departure_time  TIME NOT NULL,
  seats_total     SMALLINT NOT NULL CHECK (seats_total > 0),
  fare            NUMERIC(6,2),
  pickup_area_radius_km NUMERIC(4,2) DEFAULT 2.0,
  stops           JSONB DEFAULT '[]',
  status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_instances (
  id                SERIAL PRIMARY KEY,
  ride_template_id  INT NOT NULL REFERENCES ride_templates(id),
  trip_date         DATE NOT NULL,
  departure_at      TIMESTAMPTZ NOT NULL,
  seats_remaining   SMALLINT NOT NULL,
  status            VARCHAR(12) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ride_template_id, trip_date)
);

CREATE TABLE IF NOT EXISTS join_requests (
  id            SERIAL PRIMARY KEY,
  trip_id       INT NOT NULL REFERENCES trip_instances(id),
  rider_id      INT NOT NULL REFERENCES users(id),
  status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn')),
  pickup_lat    DOUBLE PRECISION,
  pickup_lng    DOUBLE PRECISION,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  UNIQUE (trip_id, rider_id)
);

CREATE TABLE IF NOT EXISTS waitlist (
  id          SERIAL PRIMARY KEY,
  trip_id     INT NOT NULL REFERENCES trip_instances(id),
  rider_id    INT NOT NULL REFERENCES users(id),
  position    INT NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'expired', 'accepted', 'left')),
  offer_expires_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, rider_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id          SERIAL PRIMARY KEY,
  trip_id     INT NOT NULL REFERENCES trip_instances(id),
  author_id   INT NOT NULL REFERENCES users(id),
  subject_id  INT NOT NULL REFERENCES users(id),
  direction   VARCHAR(15) NOT NULL CHECK (direction IN ('rider_to_driver', 'driver_to_rider')),
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, author_id, subject_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  type        VARCHAR(30) NOT NULL,
  message     TEXT NOT NULL,
  trip_id     INT REFERENCES trip_instances(id),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  trip_id     INT NOT NULL REFERENCES trip_instances(id),
  user_id     INT NOT NULL REFERENCES users(id),
  showed_up   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_templates_driver ON ride_templates(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_templates_status ON ride_templates(status);
CREATE INDEX IF NOT EXISTS idx_ride_templates_weekday ON ride_templates(weekday);
CREATE INDEX IF NOT EXISTS idx_trip_instances_template ON trip_instances(ride_template_id);
CREATE INDEX IF NOT EXISTS idx_trip_instances_date ON trip_instances(trip_date);
CREATE INDEX IF NOT EXISTS idx_trip_instances_status ON trip_instances(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_trip ON join_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_rider ON join_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_trip ON waitlist(trip_id);
CREATE INDEX IF NOT EXISTS idx_ratings_subject ON ratings(subject_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_attendance_trip ON attendance(trip_id);
