import { describe, expect, it } from "vitest";
import { extractMeetingUrl } from "@/lib/utils";
import type { MeetingCreateInput } from "@/types";

describe("extractMeetingUrl", () => {
  it("extracts and formats valid meeting_link with https", () => {
    const meeting = {
      meeting_link: "meet.google.com/abc-defg-hij",
      location: "Online",
    };
    expect(extractMeetingUrl(meeting)).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("preserves full https URL from meeting_link", () => {
    const meeting = {
      meeting_link: "https://zoom.us/j/123456789",
    };
    expect(extractMeetingUrl(meeting)).toBe("https://zoom.us/j/123456789");
  });

  it("extracts URL embedded in location when meeting_link is empty", () => {
    const meeting = {
      meeting_link: null,
      location: "Join at https://teams.microsoft.com/l/meetup-join/123",
    };
    expect(extractMeetingUrl(meeting)).toBe("https://teams.microsoft.com/l/meetup-join/123");
  });

  it("returns null when neither meeting_link nor location contains a URL", () => {
    const meeting = {
      meeting_link: null,
      location: "Room 402",
    };
    expect(extractMeetingUrl(meeting)).toBeNull();
  });

  it("returns null when meeting input has empty strings", () => {
    const meeting = {
      meeting_link: "   ",
      location: "   ",
    };
    expect(extractMeetingUrl(meeting)).toBeNull();
  });
});

describe("MeetingCreateInput payload verification", () => {
  it("creates a payload with optional meeting_link field", () => {
    const input: MeetingCreateInput = {
      title: "Design Sync",
      start_time: "2026-07-27T10:00:00Z",
      end_time: "2026-07-27T10:30:00Z",
      meeting_link: "https://meet.google.com/xyz-uvwx-rst",
    };
    expect(input.meeting_link).toBe("https://meet.google.com/xyz-uvwx-rst");
  });

  it("allows meeting_link to be undefined or null", () => {
    const input: MeetingCreateInput = {
      title: "Standalone Meeting",
      start_time: "2026-07-27T11:00:00Z",
      end_time: "2026-07-27T11:30:00Z",
      meeting_link: undefined,
    };
    expect(input.meeting_link).toBeUndefined();
  });
});
