"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { PageTreeNode } from "@/types/page";
import { ChevronRight } from "lucide-react";

export function BreadcrumbNav() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const activePageId = params?.pageId as string;
  const { activeWorkspace, pageTree } = useWorkspaceStore();

  // Find ancestor path for activePageId
  const path: PageTreeNode[] = [];
  function findPath(nodes: PageTreeNode[], targetId: string, currentPath: PageTreeNode[]): boolean {
    for (const node of nodes) {
      const nextPath = [...currentPath, node];
      if (node.id === targetId) {
        path.push(...nextPath);
        return true;
      }
      if (node.children.length > 0) {
        if (findPath(node.children, targetId, nextPath)) return true;
      }
    }
    return false;
  }

  if (activePageId && pageTree.length > 0) {
    findPath(pageTree, activePageId, []);
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-slate-500 overflow-hidden">
      <Link
        href={`/${workspaceSlug}`}
        className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors truncate max-w-[120px]"
      >
        {activeWorkspace?.name || "Workspace"}
      </Link>

      {path.map((item, index) => {
        const isLast = index === path.length - 1;
        return (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <Link
              href={`/${workspaceSlug}/${item.id}`}
              className={`flex items-center gap-1 truncate max-w-[150px] transition-colors ${
                isLast
                  ? "text-slate-900 dark:text-white font-medium"
                  : "hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span>{item.icon || "📄"}</span>
              <span className="truncate">{item.title || "Untitled"}</span>
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
