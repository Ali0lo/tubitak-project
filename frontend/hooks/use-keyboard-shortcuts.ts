"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandPaletteStore } from "@/stores/use-command-palette-store";
import { useQuickAddStore } from "@/stores/use-quick-add-store";
import { useSearchModalStore } from "@/stores/use-search-modal-store";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const pendingGKeyRef = useRef(false);
  const gTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut listeners when typing inside input/textarea elements
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Cmd+K / Ctrl+K Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useCommandPaletteStore.getState().togglePalette();
        return;
      }

      // Single Key shortcuts
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        useQuickAddStore.getState().openQuickAdd();
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        useSearchModalStore.getState().openSearch();
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setHelpOpen(false);
        useSearchModalStore.getState().closeSearch();
        useCommandPaletteStore.getState().closePalette();
        useQuickAddStore.getState().closeQuickAdd();
        return;
      }

      // Two-key chord navigation: G then D / T / C
      if (e.key.toLowerCase() === "g") {
        pendingGKeyRef.current = true;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        gTimerRef.current = setTimeout(() => {
          pendingGKeyRef.current = false;
        }, 1000);
        return;
      }

      if (pendingGKeyRef.current) {
        const key = e.key.toLowerCase();
        pendingGKeyRef.current = false;
        if (key === "d") {
          e.preventDefault();
          router.push("/dashboard");
        } else if (key === "t") {
          e.preventDefault();
          router.push("/tasks");
        } else if (key === "c") {
          e.preventDefault();
          router.push("/calendar");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return { isHelpOpen, setHelpOpen };
}
