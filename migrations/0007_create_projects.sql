-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  deadline_date TEXT,
  deadline_time TEXT,
  contact TEXT,
  description TEXT,
  image_url TEXT, -- JSON array of image URLs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add project_id to tasks and project_updates
ALTER TABLE tasks ADD COLUMN project_id TEXT;
ALTER TABLE project_updates ADD COLUMN project_id TEXT;

-- Auto-migrate existing clients to have a default project
INSERT INTO projects (id, client_id, name, deadline_date, deadline_time, contact, description, image_url, created_at, updated_at)
SELECT 
  'project-' || id AS id,
  id AS client_id,
  COALESCE(NULLIF(project_name, ''), 'General Project') AS name,
  project_deadline_date AS deadline_date,
  project_deadline_time AS deadline_time,
  contact AS contact,
  project_info AS description,
  project_image_url AS image_url,
  created_at,
  created_at
FROM users 
WHERE role = 'client';

-- Link existing tasks to the new default projects
UPDATE tasks 
SET project_id = 'project-' || client_id
WHERE client_id IN (SELECT id FROM users WHERE role = 'client');

-- Link existing project updates to the new default projects
UPDATE project_updates 
SET project_id = 'project-' || client_id
WHERE client_id IN (SELECT id FROM users WHERE role = 'client');
