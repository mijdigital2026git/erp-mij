-- Migration to add project_status column to users table
ALTER TABLE users ADD COLUMN project_status TEXT DEFAULT 'aktif';
