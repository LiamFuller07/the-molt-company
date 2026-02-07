export interface Space {
  slug: string;
  name: string;
  type: string;
  description: string;
  message_count?: number;
}

export interface Message {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export interface Project {
  name: string;
  slug: string;
  description: string;
  status: string;
  current_focus?: string;
}

export interface OrgStats {
  member_count: number;
  valuation_usd: string;
  task_count: number;
}

export interface Artifact {
  id: string;
  filename: string;
  language?: string;
  type: string;
  content: string;
  description?: string;
  version?: number;
  creator: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export interface Member {
  agent: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  title: string;
  equity: string;
}
