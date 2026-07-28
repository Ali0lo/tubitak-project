"use client";

import React, { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Flame, Award } from "lucide-react";
import { Confetti } from "@/components/ui/confetti";

interface StreakCelebrationModalProps {
  currentStreak: number;
}

const CELEBRATION_MILESTONES = [3, 7, 14, 30, 100];

export function StreakCelebrationModal({ currentStreak }: StreakCelebrationModalProps) {
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (CELEBRATION_MILESTONES.includes(currentStreak)) {
      const storageKey = `todotak-streak-celebrated-${currentStreak}`;
      const hasCelebrated = localStorage.getItem(storageKey);
      if (!hasCelebrated) {
        setActiveMilestone(currentStreak);
        setShowConfetti(true);
        localStorage.setItem(storageKey, "true");
      }
    }
  }, [currentStreak]);

  if (!activeMilestone) return null;

  return (
    <>
      <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      <Dialog
        open={Boolean(activeMilestone)}
        onClose={() => setActiveMilestone(null)}
        title={`🔥 ${activeMilestone}-Day Streak Milestone!`}
      >
        <div className="text-center space-y-4 py-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-2 border-amber-300 dark:border-amber-700 animate-bounce">
            <Flame className="h-8 w-8" />
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Incredible momentum! You have consistently completed your tasks for {activeMilestone} days in a row. Keep the fire burning!
          </p>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900 flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Award className="h-4 w-4" />
            <span>Streak Champion Badge Progress Unlocked</span>
          </div>

          <button
            type="button"
            onClick={() => setActiveMilestone(null)}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-md shadow-sm transition-colors"
          >
            Keep Crushing It!
          </button>
        </div>
      </Dialog>
    </>
  );
}
