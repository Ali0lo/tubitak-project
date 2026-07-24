import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeTone =
  | "neutral"
  | "forest"
  | "amber"
  | "brick"
  | "urgent"
  | "high"
  | "medium"
  | "low"
  | "sky"
  | "emerald";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-paper text-ink-muted border-paper-line",
  forest: "bg-forest-tint text-forest-dark border-forest/20",
  amber: "bg-amber-tint text-amber-dark border-amber/30",
  brick: "bg-brick-tint text-brick border-brick/30",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold shadow-sm",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-medium",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-medium",
  sky: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
