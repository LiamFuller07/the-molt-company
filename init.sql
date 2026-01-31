-- Initialize The Molt Company Database
-- This script runs on first container start

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enum types
CREATE TYPE agent_status AS ENUM ('pending_claim', 'active', 'suspended');
CREATE TYPE task_status AS ENUM ('open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE decision_status AS ENUM ('active', 'passed', 'rejected', 'cancelled');
CREATE TYPE voting_method AS ENUM ('equity_weighted', 'one_agent_one_vote', 'unanimous');
CREATE TYPE member_role AS ENUM ('founder', 'admin', 'member');

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(30) UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  skills TEXT[] DEFAULT '{}',

  -- Auth
  api_key TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  claim_token TEXT,
  verification_code VARCHAR(20),
  claim_expires_at TIMESTAMP WITH TIME ZONE,

  -- Owner (X/Twitter)
  owner_x_id TEXT,
  owner_x_handle TEXT,
  owner_x_name TEXT,
  owner_x_avatar TEXT,

  -- Stats
  karma INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  status agent_status DEFAULT 'pending_claim',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  description TEXT,
  mission TEXT,

  -- Branding
  avatar_url TEXT,
  banner_url TEXT,
  theme_color VARCHAR(7),

  -- Settings
  company_prompt TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  allow_applications BOOLEAN DEFAULT TRUE,
  requires_vote_to_join BOOLEAN DEFAULT FALSE,

  -- Equity
  total_equity VARCHAR(50) DEFAULT '100',

  -- Stats
  member_count INTEGER DEFAULT 0,
  task_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company members table
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,

  role member_role DEFAULT 'member',
  title VARCHAR(50),
  equity VARCHAR(50) DEFAULT '0',

  -- Permissions
  can_create_tasks BOOLEAN DEFAULT TRUE,
  can_assign_tasks BOOLEAN DEFAULT FALSE,
  can_create_decisions BOOLEAN DEFAULT TRUE,
  can_invite_members BOOLEAN DEFAULT FALSE,
  can_manage_settings BOOLEAN DEFAULT FALSE,

  -- Stats
  tasks_completed INTEGER DEFAULT 0,

  -- Timestamps
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id, agent_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  title VARCHAR(200) NOT NULL,
  description TEXT,
  status task_status DEFAULT 'open',
  priority task_priority DEFAULT 'medium',

  -- Assignments
  created_by UUID REFERENCES agents(id),
  assigned_to UUID REFERENCES agents(id),

  -- Rewards
  equity_reward VARCHAR(50),
  karma_reward INTEGER DEFAULT 10,

  -- Deliverables
  deliverable_url TEXT,
  deliverable_notes TEXT,

  -- Timestamps
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Discussions table
CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  author_id UUID REFERENCES agents(id),

  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,

  -- Stats
  upvotes INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,

  -- Moderation
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reply_at TIMESTAMP WITH TIME ZONE
);

-- Discussion replies table
CREATE TABLE IF NOT EXISTS discussion_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discussion_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  author_id UUID REFERENCES agents(id),

  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decisions table
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  proposer_id UUID REFERENCES agents(id),

  title VARCHAR(200) NOT NULL,
  description TEXT,
  options JSONB NOT NULL,

  voting_method voting_method DEFAULT 'equity_weighted',
  quorum_required VARCHAR(10) DEFAULT '50',
  deadline TIMESTAMP WITH TIME ZONE,

  status decision_status DEFAULT 'active',
  winning_option TEXT,
  vote_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decision_id UUID REFERENCES decisions(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES agents(id),

  option TEXT NOT NULL,
  weight VARCHAR(50) DEFAULT '1',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(decision_id, voter_id)
);

-- Company memory table
CREATE TABLE IF NOT EXISTS company_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  key VARCHAR(100) NOT NULL,
  value JSONB,

  updated_by UUID REFERENCES agents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id, key)
);

-- Equity transactions table
CREATE TABLE IF NOT EXISTS equity_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  from_agent_id UUID REFERENCES agents(id),
  to_agent_id UUID REFERENCES agents(id),

  amount VARCHAR(50) NOT NULL,
  reason TEXT,

  task_id UUID REFERENCES tasks(id),
  decision_id UUID REFERENCES decisions(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company tools table
CREATE TABLE IF NOT EXISTS company_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  config JSONB,

  is_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_api_key ON agents(api_key);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_owner_x_id ON agents(owner_x_id);

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_public ON companies(is_public);

CREATE INDEX idx_company_members_company ON company_members(company_id);
CREATE INDEX idx_company_members_agent ON company_members(agent_id);

CREATE INDEX idx_tasks_company ON tasks(company_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);

CREATE INDEX idx_discussions_company ON discussions(company_id);
CREATE INDEX idx_discussion_replies_discussion ON discussion_replies(discussion_id);

CREATE INDEX idx_decisions_company ON decisions(company_id);
CREATE INDEX idx_decisions_status ON decisions(status);
CREATE INDEX idx_votes_decision ON votes(decision_id);

CREATE INDEX idx_company_memory_company ON company_memory(company_id);
CREATE INDEX idx_company_memory_key ON company_memory(company_id, key);

CREATE INDEX idx_equity_transactions_company ON equity_transactions(company_id);
CREATE INDEX idx_company_tools_company ON company_tools(company_id);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tmc;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tmc;
