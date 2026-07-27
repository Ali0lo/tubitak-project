/**
 * Web Audio API Sound Synthesizer for Pomodoro Timer Alarms & Chimes.
 * Plays clean digital bell/chime tones without requiring external audio files.
 */

class PomodoroAudioSynthesizer {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Plays a pleasant dual-chime alarm sound when a Pomodoro timer completes.
   * @param volume Volume scale between 0.0 and 1.0
   */
  playAlarmSound(volume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Chime 1 (C5 - 523.25 Hz & E5 - 659.25 Hz)
    this.playTone(ctx, masterGain, 523.25, ctx.currentTime, 0.4);
    this.playTone(ctx, masterGain, 659.25, ctx.currentTime + 0.15, 0.5);

    // Chime 2 (G5 - 783.99 Hz & C6 - 1046.50 Hz)
    this.playTone(ctx, masterGain, 783.99, ctx.currentTime + 0.5, 0.4);
    this.playTone(ctx, masterGain, 1046.5, ctx.currentTime + 0.65, 0.8);

    // Repeated double chime for alarm feel
    this.playTone(ctx, masterGain, 659.25, ctx.currentTime + 1.2, 0.4);
    this.playTone(ctx, masterGain, 1046.5, ctx.currentTime + 1.35, 1.0);
  }

  /**
   * Plays a short subtle break-start sound.
   */
  playBreakSound(volume = 0.6) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    this.playTone(ctx, masterGain, 440.0, ctx.currentTime, 0.3); // A4
    this.playTone(ctx, masterGain, 554.37, ctx.currentTime + 0.2, 0.4); // C#5
    this.playTone(ctx, masterGain, 659.25, ctx.currentTime + 0.4, 0.6); // E5
  }

  /**
   * Plays a quick test tone for testing volume settings.
   */
  playTestSound(volume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    this.playTone(ctx, masterGain, 523.25, ctx.currentTime, 0.3);
    this.playTone(ctx, masterGain, 659.25, ctx.currentTime + 0.15, 0.4);
    this.playTone(ctx, masterGain, 783.99, ctx.currentTime + 0.3, 0.5);
  }

  private playTone(
    ctx: AudioContext,
    outputNode: AudioNode,
    frequency: number,
    startTime: number,
    duration: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, startTime);

    // Smooth bell-like envelope curve
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(outputNode);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}

export const pomodoroAudio = new PomodoroAudioSynthesizer();
