import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITE_MAX_USES,
  INVITE_JOIN_PER_IP,
  INVITE_LOOKUP_PER_IP,
} from "./defaults";

describe("launch invite capacity", () => {
  it("caps a single invite link at 200 uses", () => {
    expect(DEFAULT_INVITE_MAX_USES).toBe(200);
  });

  it("allows a burst of joins from the same network", () => {
    expect(INVITE_JOIN_PER_IP).toBe(60);
    expect(INVITE_LOOKUP_PER_IP).toBe(60);
  });
});
