import { Workspace, WorkspaceCreateInput } from "@/types/workspace";
import {
  Page,
  PageCreateInput,
  PageMoveInput,
  PageTreeNode,
  PageUpdateInput,
} from "@/types/page";
import {
  Block,
  BlockCreateInput,
  BlockMoveInput,
  BlockTreeNode,
  BlockUpdateInput,
} from "@/types/block";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage =
            typeof errorData.detail === "string"
              ? errorData.detail
              : JSON.stringify(errorData.detail);
        }
      } catch {
        // use default message
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  // Workspaces
  async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>("/workspaces");
  }

  async getWorkspace(idOrSlug: string): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${idOrSlug}`);
  }

  async createWorkspace(data: { name: string; slug: string; icon?: string }): Promise<Workspace> {
    return this.request<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Pages
  async getPageTree(
    workspaceId: string,
    includeArchived = false
  ): Promise<PageTreeNode[]> {
    return this.request<PageTreeNode[]>(
      `/pages/tree/${workspaceId}?include_archived=${includeArchived}`
    );
  }

  async getPage(pageId: string): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}`);
  }

  async createPage(data: PageCreateInput): Promise<Page> {
    return this.request<Page>("/pages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePage(pageId: string, data: PageUpdateInput): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async movePage(pageId: string, data: PageMoveInput): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deletePage(pageId: string): Promise<void> {
    return this.request<void>(`/pages/${pageId}`, {
      method: "DELETE",
    });
  }

  // Blocks
  async getPageBlocks(pageId: string): Promise<Block[]> {
    return this.request<Block[]>(`/blocks/page/${pageId}`);
  }

  async getPageBlockTree(pageId: string): Promise<BlockTreeNode[]> {
    return this.request<BlockTreeNode[]>(`/blocks/page/${pageId}/tree`);
  }

  async createBlock(data: BlockCreateInput): Promise<Block> {
    return this.request<Block>("/blocks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBlock(blockId: string, data: BlockUpdateInput): Promise<Block> {
    return this.request<Block>(`/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async moveBlock(blockId: string, data: BlockMoveInput): Promise<Block> {
    return this.request<Block>(`/blocks/${blockId}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteBlock(blockId: string): Promise<void> {
    return this.request<void>(`/blocks/${blockId}`, {
      method: "DELETE",
    });
  }

  async batchSyncBlocks(pageId: string, blocks: Block[]): Promise<Block[]> {
    return this.request<Block[]>("/blocks/batch-sync", {
      method: "POST",
      body: JSON.stringify({ page_id: pageId, blocks }),
    });
  }

  // Search
  async searchWorkspace(
    workspaceId: string,
    query: string
  ): Promise<{
    query: string;
    total: number;
    results: Array<{
      id: string;
      page_id: string;
      title: string;
      icon: string | null;
      snippet: string;
      match_type: string;
      block_id: string | null;
    }>;
  }> {
    return this.request(
      `/search?workspace_id=${workspaceId}&q=${encodeURIComponent(query)}`
    );
  }

  // Storage
  async getPresignedUpload(
    filename: string,
    contentType: string
  ): Promise<{ upload_url: string; file_url: string; key: string }> {
    return this.request("/storage/presigned-upload", {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType }),
    });
  }
}

export const apiClient = new ApiClient();
