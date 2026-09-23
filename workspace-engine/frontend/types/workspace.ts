export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceCreateInput {
  name: string;
  slug: string;
  icon?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  members: WorkspaceMember[];
}
