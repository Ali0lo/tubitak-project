"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface PixelArtProps {
  className?: string;
  size?: number;
}

/** Cute 16x16 Pixel Art Cat Mascot */
export function PixelCatMascot({ className, size = 24 }: PixelArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pixelated animate-pixel-bounce shrink-0", className)}
      aria-label="Pixel Cat Mascot"
    >
      {/* Ears */}
      <rect x="2" y="2" width="3" height="3" fill="#E67E22" />
      <rect x="3" y="3" width="1" height="1" fill="#FADBD8" />
      <rect x="11" y="2" width="3" height="3" fill="#E67E22" />
      <rect x="12" y="3" width="1" height="1" fill="#FADBD8" />
      {/* Head */}
      <rect x="3" y="4" width="10" height="7" fill="#F39C12" />
      <rect x="2" y="5" width="12" height="5" fill="#F39C12" />
      {/* Crown / Forehead stripes */}
      <rect x="7" y="4" width="2" height="2" fill="#D35400" />
      {/* Eyes */}
      <rect x="4" y="6" width="2" height="2" fill="#16A085" />
      <rect x="5" y="6" width="1" height="1" fill="#FFFFFF" />
      <rect x="10" y="6" width="2" height="2" fill="#16A085" />
      <rect x="11" y="6" width="1" height="1" fill="#FFFFFF" />
      {/* Nose & Muzzle */}
      <rect x="7" y="8" width="2" height="1" fill="#E74C3C" />
      <rect x="6" y="9" width="4" height="1" fill="#FEF9E7" />
      {/* Cheeks */}
      <rect x="3" y="8" width="1" height="1" fill="#F1948A" />
      <rect x="12" y="8" width="1" height="1" fill="#F1948A" />
      {/* Paws */}
      <rect x="4" y="11" width="3" height="3" fill="#F39C12" />
      <rect x="9" y="11" width="3" height="3" fill="#F39C12" />
      <rect x="4" y="13" width="3" height="1" fill="#FDFEFE" />
      <rect x="9" y="13" width="3" height="1" fill="#FDFEFE" />
    </svg>
  );
}

/** Cute Sleeping Pixel Cat with Floating Z z z */
export function PixelSleepingCat({ className, size = 48 }: PixelArtProps) {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Animated Zzz */}
      <div className="absolute -top-3 right-0 font-mono text-[10px] font-extrabold text-amber animate-pixel-zzz">
        Z
      </div>
      <div className="absolute -top-6 right-2 font-mono text-[8px] font-bold text-amber-dark animate-pixel-zzz [animation-delay:0.8s]">
        z
      </div>

      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pixelated animate-pixel-float"
        aria-label="Sleeping Pixel Cat"
      >
        {/* Curled Body */}
        <rect x="3" y="8" width="14" height="8" rx="1" fill="#F39C12" />
        <rect x="2" y="10" width="16" height="5" fill="#F39C12" />
        {/* Stripes */}
        <rect x="6" y="8" width="2" height="4" fill="#D35400" />
        <rect x="10" y="8" width="2" height="4" fill="#D35400" />
        {/* Sleeping Eyes (Happy closed arcs) */}
        <rect x="4" y="11" width="3" height="1" fill="#2C3E50" />
        <rect x="5" y="10" width="1" height="1" fill="#2C3E50" />
        {/* Tail Wrapped Around */}
        <rect x="15" y="12" width="3" height="4" fill="#E67E22" />
        <rect x="14" y="14" width="2" height="2" fill="#E67E22" />
        {/* Cute Pink Nose */}
        <rect x="3" y="12" width="1" height="1" fill="#E74C3C" />
      </svg>
    </div>
  );
}

/** Pixel Coffee Cup with Rising Steam */
export function PixelCoffeeCup({ className, size = 20 }: PixelArtProps) {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Steam */}
      <div className="absolute -top-2 left-1.5 w-1 h-1.5 bg-ink-faint/60 rounded-full animate-pixel-steam" />
      <div className="absolute -top-2.5 right-1.5 w-1 h-2 bg-ink-faint/40 rounded-full animate-pixel-steam [animation-delay:0.5s]" />

      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pixelated"
        aria-label="Pixel Coffee Cup"
      >
        {/* Mug Body */}
        <rect x="3" y="5" width="9" height="9" fill="#E74C3C" />
        <rect x="4" y="13" width="7" height="1" fill="#C0392B" />
        {/* Coffee Liquid */}
        <rect x="4" y="5" width="7" height="2" fill="#6E2C00" />
        {/* Handle */}
        <rect x="12" y="7" width="2" height="5" fill="#E74C3C" />
        <rect x="13" y="8" width="1" height="3" fill="#000000" fillOpacity="0.2" />
        {/* Heart Icon on Mug */}
        <rect x="6" y="8" width="1" height="1" fill="#FFFFFF" />
        <rect x="8" y="8" width="1" height="1" fill="#FFFFFF" />
        <rect x="6" y="9" width="3" height="1" fill="#FFFFFF" />
        <rect x="7" y="10" width="1" height="1" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

/** Pixel Pomodoro Tomato */
export function PixelTomato({ className, size = 20 }: PixelArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pixelated animate-pixel-pulse shrink-0", className)}
      aria-label="Pixel Pomodoro Tomato"
    >
      {/* Green Stem & Leaf */}
      <rect x="7" y="1" width="2" height="3" fill="#27AE60" />
      <rect x="5" y="2" width="2" height="1" fill="#2ECC71" />
      <rect x="9" y="2" width="2" height="1" fill="#2ECC71" />
      {/* Tomato Body */}
      <rect x="3" y="4" width="10" height="10" rx="1" fill="#E74C3C" />
      <rect x="2" y="5" width="12" height="8" fill="#E74C3C" />
      {/* Shine Highlight */}
      <rect x="4" y="6" width="2" height="2" fill="#FADBD8" />
      {/* Shadow */}
      <rect x="4" y="13" width="8" height="1" fill="#C0392B" />
    </svg>
  );
}

/** Pixel Gold Sparkle Star */
export function PixelSparkle({ className, size = 16 }: PixelArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pixelated animate-pixel-wiggle shrink-0", className)}
      aria-label="Pixel Sparkle"
    >
      <rect x="5" y="1" width="2" height="10" fill="#F1C40F" />
      <rect x="1" y="5" width="10" height="2" fill="#F1C40F" />
      <rect x="4" y="4" width="4" height="4" fill="#F39C12" />
      <rect x="5" y="5" width="2" height="2" fill="#FFFFFF" />
    </svg>
  );
}

/** Pixel Heart */
export function PixelHeart({ className, size = 16 }: PixelArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pixelated animate-pixel-bounce shrink-0", className)}
      aria-label="Pixel Heart"
    >
      <rect x="2" y="2" width="3" height="3" fill="#E74C3C" />
      <rect x="7" y="2" width="3" height="3" fill="#E74C3C" />
      <rect x="1" y="3" width="10" height="4" fill="#E74C3C" />
      <rect x="2" y="7" width="8" height="2" fill="#E74C3C" />
      <rect x="3" y="9" width="6" height="1" fill="#E74C3C" />
      <rect x="5" y="10" width="2" height="1" fill="#E74C3C" />
      {/* Shine */}
      <rect x="3" y="3" width="1" height="1" fill="#FFFFFF" />
    </svg>
  );
}

/** Interactive Cute Pixel Mascot Card for Sidebar */
export function PixelMascotSidebarWidget() {
  const [pets, setPets] = useState(0);
  const quotes = [
    "Stay cozy & focused today! ☕",
    "You're doing fantastic! ✨",
    "Remember to stretch & hydrate! 💧",
    "One task at a time, champ! 🏆",
    "Purrr... keep up the great work! 🐾",
  ];

  const currentQuote = quotes[pets % quotes.length];

  return (
    <div className="mx-3 my-3 p-3 rounded-xl bg-forest-dark/40 dark:bg-paper-line/30 border border-paper/10 dark:border-paper-line flex flex-col gap-2 transition-all">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => setPets((p) => p + 1)}
          className="focus-ring group relative rounded-lg p-1 hover:bg-paper/10 transition-transform active:scale-95"
          title="Pet the Todotak cat!"
        >
          <PixelCatMascot size={28} />
          {pets > 0 ? (
            <span className="absolute -top-2 -right-1 flex items-center gap-0.5 text-[9px] font-bold text-amber animate-pixel-bounce">
              <PixelHeart size={10} /> +{pets}
            </span>
          ) : null}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-paper/90 dark:text-ink flex items-center gap-1">
            Mascot Kiki <PixelSparkle size={10} />
          </p>
          <p className="text-[10px] text-paper/70 dark:text-ink-muted leading-tight mt-0.5 italic">
            &quot;{currentQuote}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
