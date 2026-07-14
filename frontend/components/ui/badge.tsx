import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "forest" | "amber" | "brick";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-paper text-ink-muted border-paper-line",
  forest: "bg-forest-tint text-forest-dark border-forest/20",
  amber: "bg-amber-tint text-amber-dark border-amber/30",
  brick: "bg-brick-tint text-brick border-brick/30",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
