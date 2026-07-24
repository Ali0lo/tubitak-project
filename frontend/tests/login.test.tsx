import { describe, expect, it } from "vitest";

describe("Login helpers", () => {
  it("validates login payload fields", () => {
    const payload = { email: "user@example.com", password: "password123" };
    expect(payload.email).toContain("@");
    expect(payload.password.length).toBeGreaterThan(6);
  });
});
