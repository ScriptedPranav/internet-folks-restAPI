export interface User {
  id: string;
  name?: string;
  email: string;
  password: string;
  created_at: Date;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  owner: string;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Member {
  id: string;
  community: string;
  user: string;
  role: string;
  created_at: Date;
}
