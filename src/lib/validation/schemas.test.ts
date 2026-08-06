import { describe, expect, it } from "vitest";
import {
  bookParamsSchema,
  bookPatchSchema,
  forumThreadCreateSchema,
  forumThreadPatchSchema,
  inviteJoinSchema,
  inviteTokenParamsSchema,
  meetingActionSchema,
  platformCommunityCreateSchema,
  readingProgressSchema,
  slugParamsSchema,
  subscriptionCreateSchema,
} from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("slugParamsSchema", () => {
  it("accepts a non-empty slug", () => {
    expect(slugParamsSchema.parse({ slug: "club-lectura" })).toEqual({
      slug: "club-lectura",
    });
  });

  it("rejects empty or oversized slug", () => {
    expect(slugParamsSchema.safeParse({ slug: "" }).success).toBe(false);
    expect(
      slugParamsSchema.safeParse({ slug: "x".repeat(101) }).success
    ).toBe(false);
  });
});

describe("bookParamsSchema", () => {
  it("accepts slug + bookId uuid", () => {
    expect(bookParamsSchema.parse({ slug: "demo", bookId: UUID })).toEqual({
      slug: "demo",
      bookId: UUID,
    });
  });

  it("rejects non-uuid bookId", () => {
    expect(
      bookParamsSchema.safeParse({ slug: "demo", bookId: "not-a-uuid" }).success
    ).toBe(false);
  });
});

describe("inviteTokenParamsSchema / inviteJoinSchema", () => {
  it("accepts a token", () => {
    expect(inviteTokenParamsSchema.parse({ token: "abc123" })).toEqual({
      token: "abc123",
    });
    expect(inviteJoinSchema.parse({ token: "abc123" })).toEqual({
      token: "abc123",
    });
  });

  it("rejects empty or too-long tokens", () => {
    expect(inviteJoinSchema.safeParse({ token: "" }).success).toBe(false);
    expect(
      inviteJoinSchema.safeParse({ token: "t".repeat(65) }).success
    ).toBe(false);
  });
});

describe("readingProgressSchema", () => {
  it("accepts valid progress", () => {
    expect(
      readingProgressSchema.parse({ currentPage: 2, progressPercent: 33.5 })
    ).toEqual({ currentPage: 2, progressPercent: 33.5 });
  });

  it("rejects out-of-range values", () => {
    expect(
      readingProgressSchema.safeParse({
        currentPage: -1,
        progressPercent: 10,
      }).success
    ).toBe(false);
    expect(
      readingProgressSchema.safeParse({
        currentPage: 1,
        progressPercent: 101,
      }).success
    ).toBe(false);
    expect(
      readingProgressSchema.safeParse({
        currentPage: 1.5,
        progressPercent: 10,
      }).success
    ).toBe(false);
  });
});

describe("forumThreadCreateSchema", () => {
  it("accepts trimmed title and content", () => {
    expect(
      forumThreadCreateSchema.parse({
        title: "  Hola  ",
        content: "  cuerpo  ",
      })
    ).toEqual({ title: "Hola", content: "cuerpo" });
  });

  it("rejects empty fields", () => {
    expect(
      forumThreadCreateSchema.safeParse({ title: "   ", content: "x" }).success
    ).toBe(false);
    expect(
      forumThreadCreateSchema.safeParse({ title: "x", content: "" }).success
    ).toBe(false);
  });
});

describe("forumThreadPatchSchema", () => {
  it("accepts like action or pin/feature flags", () => {
    expect(forumThreadPatchSchema.parse({ action: "like" })).toEqual({
      action: "like",
    });
    expect(forumThreadPatchSchema.parse({ is_pinned: true })).toEqual({
      is_pinned: true,
    });
  });

  it("rejects empty patch objects", () => {
    expect(forumThreadPatchSchema.safeParse({}).success).toBe(false);
  });
});

describe("meetingActionSchema", () => {
  it("accepts create / token / start actions", () => {
    expect(meetingActionSchema.parse({ action: "create", title: "Sala" })).toEqual({
      action: "create",
      title: "Sala",
    });
    expect(
      meetingActionSchema.parse({ action: "token", meetingId: UUID })
    ).toEqual({ action: "token", meetingId: UUID });
    expect(
      meetingActionSchema.parse({ action: "start", meetingId: UUID })
    ).toEqual({ action: "start", meetingId: UUID });
  });

  it("rejects token without meetingId", () => {
    expect(
      meetingActionSchema.safeParse({ action: "token" }).success
    ).toBe(false);
  });
});

describe("platformCommunityCreateSchema", () => {
  it("accepts valid community payload", () => {
    expect(
      platformCommunityCreateSchema.parse({
        name: "Club",
        ownerEmail: "owner@example.com",
        monthlyPriceCents: 1500,
      })
    ).toEqual({
      name: "Club",
      ownerEmail: "owner@example.com",
      monthlyPriceCents: 1500,
    });
  });

  it("rejects invalid email or negative price", () => {
    expect(
      platformCommunityCreateSchema.safeParse({
        name: "Club",
        ownerEmail: "not-an-email",
      }).success
    ).toBe(false);
    expect(
      platformCommunityCreateSchema.safeParse({
        name: "Club",
        ownerEmail: "owner@example.com",
        monthlyPriceCents: -1,
      }).success
    ).toBe(false);
  });
});

describe("subscriptionCreateSchema", () => {
  it("accepts communityId", () => {
    expect(subscriptionCreateSchema.parse({ communityId: UUID })).toEqual({
      communityId: UUID,
    });
  });

  it("rejects non-uuid communityId", () => {
    expect(
      subscriptionCreateSchema.safeParse({ communityId: "x" }).success
    ).toBe(false);
  });
});
