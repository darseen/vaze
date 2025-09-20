export type User = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type File = {
  id: string;
  name: string;
  folder_id: string;
  path: string;
  size: number;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKey = {
  id: string;
  name: string;
  user_id: string;
  key_hash: string;
  last_used: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
