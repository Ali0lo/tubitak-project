"use client";

import React from "react";
import { PixelSleepingCat, PixelCoffeeCup, PixelSparkle } from "@/components/ui/pixel-art";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconType?: "cat" | "coffee" | "sparkle";
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  iconType = "cat",
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-paper-tint/40 rounded-2xl border border-paper-line space-y-4 ${className}`}>
      <div className="p-3 bg-paper rounded-2xl border border-paper-line shadow-xs">
        {iconType === "cat" && <PixelSleepingCat size={38} />}
        {iconType === "coffee" && <PixelCoffeeCup size={38} />}
        {iconType === "sparkle" && <PixelSparkle size={38} />}
      </div>

      <div className="max-w-md space-y-1">
        <h3 className="font-display text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="focus-ring px-4 py-2 text-xs font-semibold bg-forest hover:bg-forest/90 text-white rounded-lg shadow-2xs transition-all active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
