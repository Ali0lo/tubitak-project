"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { PageTree } from "./page-tree";
import { apiClient } from "@/lib/api-client";
import {
  Search,
  PlusCircle,
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

interface SidebarProps {
  onOpenSearch: () => void;
}

export function Sidebar({ onOpenSearch }: SidebarProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;

  const { activeWorkspace, pageTree, addPageToTree } = useWorkspaceStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCreateRootPage = async () => {
    if (!activeWorkspace) return;

    try {
      const newPage = await apiClient.createPage({
        workspace_id: activeWorkspace.id,
        parent_id: null,
        title: "Untitled",
        icon: "📄",
      });

      addPageToTree(null, {
        id: newPage.id,
        workspace_id: newPage.workspace_id,
        parent_id: null,
        title: newPage.title,
        icon: newPage.icon,
        is_favorite: newPage.is_favorite,
        is_archived: newPage.is_archived,
        sort_order: newPage.sort_order,
        children: [],
      });

      router.push(`/${workspaceSlug}/${newPage.id}`);
    } catch (err) {
      console.error("Failed to create root page:", err);
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex-shrink-0 w-12 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-3 gap-3 transition-all duration-200 z-30">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          title="Expand Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          title="Search (Cmd+K)"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleCreateRootPage}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          title="New Page"
        >
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex-shrink-0 w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col h-screen select-none transition-all duration-200 z-30">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 text-sm">
            {activeWorkspace?.icon || "🪐"}
          </div>
          <span className="font-semibold text-sm truncate text-slate-800 dark:text-slate-100">
            {activeWorkspace?.name || "WorkspaceEngine"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Navigation */}
      <div className="px-2 py-2 space-y-0.5 border-b border-slate-200 dark:border-slate-800 text-xs">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
            ⌘K
          </span>
        </button>

        <button
          type="button"
          onClick={handleCreateRootPage}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-slate-400" />
          <span>New Page</span>
        </button>
      </div>

      {/* Hierarchical Page Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <PageTree tree={pageTree} onAddRootPage={handleCreateRootPage} />
      </div>

      {/* User / Multi-tenant Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
            W
          </div>
          <span className="truncate">WorkspaceEngine v1</span>
        </div>
      </div>
    </aside>
  );
}
