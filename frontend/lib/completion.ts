import confetti from "canvas-confetti";

/** Plays an uplifting audio chime using Web Audio API (zero external asset dependency). */
export function playTaskCompletionSound() {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = [
      { freq: 523.25, time: 0, duration: 0.12 },   // C5
      { freq: 659.25, time: 0.08, duration: 0.12 }, // E5
      { freq: 783.99, time: 0.16, duration: 0.25 }, // G5
    ];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.15, ctx.currentTime);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0, ctx.currentTime + time);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });
  } catch {
    // Non-fatal if audio context blocked or unpermitted
  }
}

/** Triggers dynamic colorful particle confetti bursts. */
export function triggerTaskCompletionConfetti() {
  if (typeof window === "undefined") return;

  try {
    // Left burst
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7, x: 0.3 },
      colors: ["#10B981", "#F59E0B", "#6366F1", "#EC4899"],
    });

    // Right burst
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7, x: 0.7 },
      colors: ["#10B981", "#F59E0B", "#6366F1", "#EC4899"],
    });
  } catch {
    // Non-fatal fallback
  }
}

/** Combined effect for task completion: audio chime + confetti animation. */
export function triggerTaskCompletionEffect() {
  playTaskCompletionSound();
  triggerTaskCompletionConfetti();
}
