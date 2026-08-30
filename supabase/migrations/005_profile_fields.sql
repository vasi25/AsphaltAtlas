-- Add car model and location to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS car_model TEXT,
  ADD COLUMN IF NOT EXISTS location  TEXT;
