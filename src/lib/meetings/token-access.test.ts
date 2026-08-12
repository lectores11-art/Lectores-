import { describe, expect, it } from "vitest";
import { decideMeetingTokenAccess } from "./token-access";

const HOST_ID = "host-user";
const MEMBER_ID = "member-user";
const ADMIN_ID = "admin-user";

describe("decideMeetingTokenAccess", () => {
  it("lets the host start a scheduled meeting when requesting a token", () => {
    const decision = decideMeetingTokenAccess({
      status: "scheduled",
      hostId: HOST_ID,
      userId: HOST_ID,
      isAdmin: false,
    });

    expect(decision).toEqual({
      ok: true,
      shouldStart: true,
      isHost: true,
    });
  });

  it("lets a community admin start a scheduled meeting they did not host", () => {
    const decision = decideMeetingTokenAccess({
      status: "scheduled",
      hostId: HOST_ID,
      userId: ADMIN_ID,
      isAdmin: true,
    });

    expect(decision).toEqual({
      ok: true,
      shouldStart: true,
      isHost: true,
    });
  });

  it("blocks members from joining a scheduled meeting", () => {
    const decision = decideMeetingTokenAccess({
      status: "scheduled",
      hostId: HOST_ID,
      userId: MEMBER_ID,
      isAdmin: false,
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.httpStatus).toBe(409);
    expect(decision.error).toMatch(/todavía no está en vivo/i);
  });

  it("issues a token for a live meeting without starting again", () => {
    const decision = decideMeetingTokenAccess({
      status: "live",
      hostId: HOST_ID,
      userId: MEMBER_ID,
      isAdmin: false,
    });

    expect(decision).toEqual({
      ok: true,
      shouldStart: false,
      isHost: false,
    });
  });

  it("rejects ended meetings for host and members", () => {
    for (const userId of [HOST_ID, MEMBER_ID]) {
      const decision = decideMeetingTokenAccess({
        status: "ended",
        hostId: HOST_ID,
        userId,
        isAdmin: userId === HOST_ID,
      });

      expect(decision.ok).toBe(false);
      if (decision.ok) return;
      expect(decision.httpStatus).toBe(410);
      expect(decision.error).toMatch(/finalizó/i);
    }
  });
});
