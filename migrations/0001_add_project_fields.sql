-- Add project details and information columns to users table
ALTER TABLE users ADD COLUMN project_name TEXT;
ALTER TABLE users ADD COLUMN project_deadline_date TEXT;
ALTER TABLE users ADD COLUMN project_deadline_time TEXT;
ALTER TABLE users ADD COLUMN contact TEXT;
ALTER TABLE users ADD COLUMN project_info TEXT;
