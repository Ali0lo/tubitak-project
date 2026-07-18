"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          className={cn(
            "focus-ring w-full rounded-seal border border-paper-line bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
            error && "border-brick",
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-brick">{error}</p> : null}
      </div>
    );
  }
);
Input.displayName = "Input";
