"use client";

import React, { useState } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import {
  SavedViewPreset,
  useSavedViewsStore,
} from "@/stores/use-saved-views-store";
import { cn } from "@/lib/utils";
import type { TaskFilters } from "@/types";
import type { TaskViewMode } from "@/components/tasks/task-view-switcher";

interface SavedViewsBarProps {
  currentFilters: TaskFilters;
  currentViewMode: TaskViewMode;
  onApplyPreset: (preset: SavedViewPreset) => void;
}

export function SavedViewsBar({
  currentFilters,
  currentViewMode,
  onApplyPreset,
}: SavedViewsBarProps) {
  const { presets, activePresetId, selectPreset, saveCustomPreset, deleteCustomPreset } =
    useSavedViewsStore();

  const [isSaveModalOpen, setSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const handleSelect = (preset: SavedViewPreset) => {
    selectPreset(preset.id);
    onApplyPreset(preset);
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    saveCustomPreset(newPresetName.trim(), {
      filters: currentFilters,
      sorting: "due_date",
      grouping: "none",
      viewMode: currentViewMode,
    });

    setNewPresetName("");
    setSaveModalOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line pb-3">
      {/* Saved View Preset Pills */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pr-2">
        <span className="text-xs font-semibold text-ink-faint flex items-center gap-1 mr-1">
          <Bookmark className="h-3.5 w-3.5" /> Views:
        </span>

        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;

          return (
            <div key={preset.id} className="inline-flex items-center group">
              <button
                type="button"
                onClick={() => handleSelect(preset)}
                className={cn(
                  "focus-ring rounded-md px-2.5 py-1 text-xs font-medium transition-all border",
                  isActive
                    ? "bg-forest text-paper border-forest font-semibold shadow-xs"
                    : "bg-paper text-ink-muted border-paper-line hover:bg-paper-raised hover:text-ink"
                )}
              >
                {preset.name}
              </button>

              {!preset.isBuiltIn && (
                <button
                  type="button"
                  onClick={() => deleteCustomPreset(preset.id)}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 p-0.5 text-ink-faint hover:text-brick transition-opacity"
                  title="Delete view preset"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Save View Button */}
      <button
        type="button"
        onClick={() => setSaveModalOpen(true)}
        className="focus-ring inline-flex items-center gap-1 rounded-md border border-paper-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-paper-raised hover:text-ink transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Save View</span>
      </button>

      {/* Save View Dialog */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-paper-line bg-paper p-5 shadow-xl animate-in zoom-in-95">
            <h3 className="font-display font-bold text-base text-ink">Save Current View</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Save your current filter and layout options as a reusable preset.
            </p>

            <form onSubmit={handleSaveCurrent} className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="View Name (e.g. My Urgent Sprint)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
                className="focus-ring w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="focus-ring rounded-md border border-paper-line px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPresetName.trim()}
                  className="focus-ring rounded-md bg-forest px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-50"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
