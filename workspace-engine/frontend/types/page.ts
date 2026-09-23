export interface Page {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_image: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  sort_order: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PageTreeNode {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  sort_order: string;
  children: PageTreeNode[];
}

export interface PageCreateInput {
  workspace_id: string;
  parent_id?: string | null;
  title?: string;
  icon?: string;
  cover_image?: string;
  before_page_id?: string;
  after_page_id?: string;
}

export interface PageUpdateInput {
  title?: string;
  icon?: string | null;
  cover_image?: string | null;
  is_favorite?: boolean;
  is_archived?: boolean;
  parent_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PageMoveInput {
  new_parent_id?: string | null;
  before_page_id?: string;
  after_page_id?: string;
}
