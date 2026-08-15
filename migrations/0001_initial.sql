PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  funnel_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'partial',
  zip TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_raw TEXT,
  phone_e164 TEXT,
  email_raw TEXT,
  email_normalized TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  consent_json TEXT,
  first_url TEXT NOT NULL,
  original_query_string TEXT NOT NULL,
  fbc TEXT,
  fbp TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  ip_address TEXT,
  user_agent TEXT,
  conversion_value REAL,
  conversion_event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  delivered_to_ghl_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_phone_created
  ON leads(phone_e164, created_at);

CREATE INDEX IF NOT EXISTS idx_leads_email_created
  ON leads(email_normalized, created_at);

CREATE TABLE IF NOT EXISTS tracking_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  lead_id TEXT,
  event_name TEXT NOT NULL,
  source TEXT NOT NULL,
  event_time INTEGER NOT NULL,
  event_source_url TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  custom_data_json TEXT NOT NULL DEFAULT '{}',
  browser_fired_at TEXT,
  server_fired_at TEXT,
  capi_status TEXT NOT NULL DEFAULT 'pending',
  capi_attempts INTEGER NOT NULL DEFAULT 0,
  capi_last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_session_event
  ON tracking_events(session_id, event_name, sequence);

CREATE TABLE IF NOT EXISTS downstream_conversions (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  lead_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  value REAL NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dropped_capi_events (
  event_id TEXT PRIMARY KEY,
  dropped_at TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
