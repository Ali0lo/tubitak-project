"use client";

import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "focus-ring w-full resize-none rounded-seal border border-paper-line bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
