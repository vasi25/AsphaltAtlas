-- Replace generic location text with structured country + city fields
ALTER TABLE profiles
  DROP COLUMN IF EXISTS location,
  ADD COLUMN IF NOT EXISTS location_country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS location_city         TEXT;
