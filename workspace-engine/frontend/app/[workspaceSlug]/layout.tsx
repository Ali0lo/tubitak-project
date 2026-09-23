"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { SearchModal } from "@/components/search/search-modal";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { apiClient } from "@/lib/api-client";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;

  const {
    setActiveWorkspace,
    setPageTree,
    setIsLoadingTree,
  } = useWorkspaceStore();

  const [searchOpen, setSearchOpen] = useState(false);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Fetch workspace and page tree
  useEffect(() => {
    if (!workspaceSlug) return;

    let isMounted = true;
    async function loadWorkspaceData() {
      setIsLoadingTree(true);
      try {
        let ws = null;
        try {
          ws = await apiClient.getWorkspace(workspaceSlug);
        } catch {
          // If workspace doesn't exist yet, auto-create default developer workspace
          ws = await apiClient.createWorkspace({
            name: "Personal Workspace",
            slug: workspaceSlug,
            icon: "🪐",
          });
        }

        if (isMounted && ws) {
          setActiveWorkspace(ws);
          const tree = await apiClient.getPageTree(ws.id);
          setPageTree(tree);
        }
      } catch (err) {
        console.error("Failed to load workspace data:", err);
      } finally {
        if (isMounted) {
          setIsLoadingTree(false);
        }
      }
    }

    loadWorkspaceData();
    return () => {
      isMounted = false;
    };
  }, [workspaceSlug, setActiveWorkspace, setPageTree, setIsLoadingTree]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-950">
      {/* Left Collapsible Sidebar */}
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />

      {/* Main Workspace Frame */}
      <div className="flex flex-col flex-1 h-screen min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Global Cmd+K Fuzzy Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
