-- Migration to add story column to tasks table to log editor history
ALTER TABLE tasks ADD COLUMN story TEXT;
