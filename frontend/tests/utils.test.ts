import { describe, expect, it } from "vitest";

import {
  cn,
  formatDateLabel,
  formatTimestamp,
  isoToLocalInput,
  localInputToIso,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-ink", undefined, false, "font-bold")).toBe(
      "text-ink font-bold"
    );
  });
});

describe("formatTimestamp", () => {
  it("formats an ISO string as HH:mm", () => {
    const iso = new Date(2026, 6, 20, 14, 30).toISOString();
    expect(formatTimestamp(iso)).toBe("14:30");
  });
});

describe("formatDateLabel", () => {
  it("labels today as 'Today'", () => {
    const now = new Date();
    expect(formatDateLabel(now.toISOString())).toBe("Today");
  });

  it("labels a far-future date with month and day", () => {
    const future = new Date(2030, 0, 15);
    expect(formatDateLabel(future.toISOString())).toBe("Jan 15");
  });
});

describe("localInputToIso / isoToLocalInput", () => {
  it("round-trips a datetime-local value", () => {
    const localValue = "2026-07-20T14:30";
    const iso = localInputToIso(localValue);
    expect(iso).toBeDefined();
    expect(isoToLocalInput(iso)).toBe(localValue);
  });

  it("returns undefined for an empty input", () => {
    expect(localInputToIso("")).toBeUndefined();
  });

  it("returns an empty string for a null/undefined ISO value", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput(undefined)).toBe("");
  });
});
