"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { apiClient } from "@/lib/api-client";
import { FilePlus2, Sparkles } from "lucide-react";

export default function WorkspaceIndexPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const { activeWorkspace, pageTree, addPageToTree } = useWorkspaceStore();

  useEffect(() => {
    if (pageTree.length > 0) {
      router.push(`/${workspaceSlug}/${pageTree[0].id}`);
    }
  }, [pageTree, workspaceSlug, router]);

  const handleCreateFirstPage = async () => {
    if (!activeWorkspace) return;

    try {
      const page = await apiClient.createPage({
        workspace_id: activeWorkspace.id,
        parent_id: null,
        title: "Welcome to WorkspaceEngine",
        icon: "🚀",
      });

      addPageToTree(null, {
        id: page.id,
        workspace_id: page.workspace_id,
        parent_id: null,
        title: page.title,
        icon: page.icon,
        is_favorite: page.is_favorite,
        is_archived: page.is_archived,
        sort_order: page.sort_order,
        children: [],
      });

      router.push(`/${workspaceSlug}/${page.id}`);
    } catch (err) {
      console.error("Failed to create first page:", err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm border border-indigo-100 dark:border-indigo-900/40">
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Welcome to your block workspace
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">
        Start writing with nested pages, slash commands, real-time collaboration, and rich media blocks.
      </p>

      <button
        type="button"
        onClick={handleCreateFirstPage}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl shadow transition-all hover:scale-105"
      >
        <FilePlus2 className="w-4 h-4" />
        <span>Create your first page</span>
      </button>
    </div>
  );
}
