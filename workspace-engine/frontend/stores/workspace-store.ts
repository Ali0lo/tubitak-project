import { create } from "zustand";
import { Workspace } from "@/types/workspace";
import { PageTreeNode } from "@/types/page";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  pageTree: PageTreeNode[];
  expandedPageIds: string[];
  activePageId: string | null;
  isLoadingTree: boolean;

  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setPageTree: (tree: PageTreeNode[]) => void;
  togglePageExpanded: (pageId: string) => void;
  setPageExpanded: (pageId: string, expanded: boolean) => void;
  setActivePageId: (pageId: string | null) => void;
  setIsLoadingTree: (loading: boolean) => void;

  addPageToTree: (parent_id: string | null, newPage: PageTreeNode) => void;
  updatePageInTree: (pageId: string, updates: Partial<PageTreeNode>) => void;
  removePageFromTree: (pageId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  pageTree: [],
  expandedPageIds: [],
  activePageId: null,
  isLoadingTree: false,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  setPageTree: (pageTree) => set({ pageTree }),

  togglePageExpanded: (pageId) =>
    set((state) => {
      const exists = state.expandedPageIds.includes(pageId);
      return {
        expandedPageIds: exists
          ? state.expandedPageIds.filter((id) => id !== pageId)
          : [...state.expandedPageIds, pageId],
      };
    }),

  setPageExpanded: (pageId, expanded) =>
    set((state) => ({
      expandedPageIds: expanded
        ? Array.from(new Set([...state.expandedPageIds, pageId]))
        : state.expandedPageIds.filter((id) => id !== pageId),
    })),

  setActivePageId: (activePageId) => set({ activePageId }),
  setIsLoadingTree: (isLoadingTree) => set({ isLoadingTree }),

  addPageToTree: (parent_id, newPage) =>
    set((state) => {
      if (!parent_id) {
        const nextTree = [...state.pageTree, newPage].sort((a, b) =>
          a.sort_order.localeCompare(b.sort_order)
        );
        return { pageTree: nextTree };
      }

      function insertChild(nodes: PageTreeNode[]): PageTreeNode[] {
        return nodes.map((node) => {
          if (node.id === parent_id) {
            const nextChildren = [...node.children, newPage].sort((a, b) =>
              a.sort_order.localeCompare(b.sort_order)
            );
            return { ...node, children: nextChildren };
          }
          if (node.children.length > 0) {
            return { ...node, children: insertChild(node.children) };
          }
          return node;
        });
      }

      return {
        pageTree: insertChild(state.pageTree),
        expandedPageIds: Array.from(
          new Set([...state.expandedPageIds, parent_id])
        ),
      };
    }),

  updatePageInTree: (pageId, updates) =>
    set((state) => {
      function updateNodes(nodes: PageTreeNode[]): PageTreeNode[] {
        return nodes.map((node) => {
          if (node.id === pageId) {
            return { ...node, ...updates };
          }
          if (node.children.length > 0) {
            return { ...node, children: updateNodes(node.children) };
          }
          return node;
        });
      }
      return { pageTree: updateNodes(state.pageTree) };
    }),

  removePageFromTree: (pageId) =>
    set((state) => {
      function filterNodes(nodes: PageTreeNode[]): PageTreeNode[] {
        return nodes
          .filter((node) => node.id !== pageId)
          .map((node) => ({
            ...node,
            children: filterNodes(node.children),
          }));
      }
      return { pageTree: filterNodes(state.pageTree) };
    }),
}));
