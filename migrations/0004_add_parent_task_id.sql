-- Add parent_task_id column to tasks table
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;
