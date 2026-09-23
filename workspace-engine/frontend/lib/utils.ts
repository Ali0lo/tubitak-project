import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateColorForUser(userId: string): string {
  const colors = [
    "#f87171", // red
    "#fb923c", // orange
    "#fbbf24", // amber
    "#34d399", // emerald
    "#38bdf8", // sky
    "#818cf8", // indigo
    "#c084fc", // purple
    "#f472b6", // pink
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
