-- Migration to add device_limit column to users table
ALTER TABLE users ADD COLUMN device_limit INTEGER DEFAULT 2;
