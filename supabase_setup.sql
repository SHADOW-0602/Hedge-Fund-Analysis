-- Supabase Database Setup
-- Run these queries in your Supabase SQL Editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS portfolios ENABLE ROW LEVEL SECURITY;

-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  portfolio_name TEXT NOT NULL,
  portfolio_data JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create users table (if not using built-in auth)
CREATE TABLE IF NOT EXISTS app_users (
  user_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create research notes table
CREATE TABLE IF NOT EXISTS research_notes (
  note_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(user_id),
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_public BOOLEAN DEFAULT FALSE
);

-- Create workspaces table
CREATE TABLE IF NOT EXISTS team_workspaces (
  workspace_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES app_users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create workspace members table
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES team_workspaces(workspace_id),
  user_id UUID NOT NULL REFERENCES app_users(user_id),
  role TEXT NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Create shared access table
CREATE TABLE IF NOT EXISTS shared_access (
  share_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES app_users(user_id),
  shared_with_user_id UUID NOT NULL REFERENCES app_users(user_id),
  permission_level TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_user_id ON research_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_shared_with ON shared_access(shared_with_user_id);

-- Row Level Security Policies
CREATE POLICY "Users can view own portfolios" ON portfolios
  FOR SELECT USING (user_id = current_setting('app.current_user_id'));

CREATE POLICY "Users can insert own portfolios" ON portfolios
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id'));

CREATE POLICY "Users can update own portfolios" ON portfolios
  FOR UPDATE USING (user_id = current_setting('app.current_user_id'));

-- Insert default admin user (password: admin123)
INSERT INTO app_users (username, email, password_hash, role) 
VALUES ('admin', 'admin@hedgefund.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'admin')
ON CONFLICT (username) DO NOTHING;