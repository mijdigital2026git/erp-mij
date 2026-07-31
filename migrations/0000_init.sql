-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('client', 'prof', 'admin')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create tasks/complains table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  video_url TEXT,
  image_url TEXT,
  status TEXT CHECK(status IN ('proses', 'review', 'selesai')) DEFAULT 'proses' NOT NULL,
  conclusion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default seed users
INSERT OR IGNORE INTO users (id, code, name, role) VALUES 
('client-1', 'CLIENT123', 'Mij Digital Client', 'client'),
('prof-1', 'PROF123', 'Mij Professional Tech', 'prof'),
('admin-1', 'ADMIN123', 'Mij Main Admin', 'admin');
