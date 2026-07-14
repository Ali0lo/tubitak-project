import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex items-center justify-center py-8", className)}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-forest border-t-transparent" />
    </div>
  );
}
