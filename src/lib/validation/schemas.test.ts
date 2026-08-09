import { describe, expect, it } from "vitest";
import {
  bookParamsSchema,
  bookPatchSchema,
  bookPublishPatchSchema,
  forumThreadCreateSchema,
  forumThreadPatchSchema,
  inviteJoinSchema,
  inviteParamsSchema,
  invitePatchSchema,
  inviteTokenParamsSchema,
  meetingActionSchema,
  membershipParamsSchema,
  membershipStatusPatchSchema,
  platformCommunityCreateSchema,
  readingProgressSchema,
  slugParamsSchema,
  subscriptionCreateSchema,
  subscriptionPortalSchema,
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

describe("bookPublishPatchSchema", () => {
  it("accepts boolean is_published", () => {
    expect(bookPublishPatchSchema.parse({ is_published: true })).toEqual({
      is_published: true,
    });
    expect(bookPublishPatchSchema.parse({ is_published: false })).toEqual({
      is_published: false,
    });
  });

  it("rejects missing or non-boolean is_published", () => {
    expect(bookPublishPatchSchema.safeParse({}).success).toBe(false);
    expect(
      bookPublishPatchSchema.safeParse({ is_published: "true" }).success
    ).toBe(false);
  });
});

describe("bookPatchSchema", () => {
  it("accepts publish-only and metadata patches", () => {
    expect(bookPatchSchema.parse({ is_published: false })).toEqual({
      is_published: false,
    });
    expect(
      bookPatchSchema.parse({
        title: "Nuevo título",
        author: "Autora",
        description: null,
      })
    ).toEqual({
      title: "Nuevo título",
      author: "Autora",
      description: null,
    });
  });

  it("accepts coverStoragePath alone", () => {
    expect(
      bookPatchSchema.parse({ coverStoragePath: `${UUID}/cover.jpg` })
    ).toEqual({ coverStoragePath: `${UUID}/cover.jpg` });
  });

  it("rejects empty patch", () => {
    expect(bookPatchSchema.safeParse({}).success).toBe(false);
  });

  it("strips mass-assignment extras (content_json / pdf / community_id)", () => {
    const parsed = bookPatchSchema.parse({
      title: "OK",
      is_published: true,
      content_json: [{ hack: true }],
      pdf_storage_path: "x/y.pdf",
      community_id: UUID,
    });
    expect(parsed).toEqual({ title: "OK", is_published: true });
    expect(parsed).not.toHaveProperty("content_json");
    expect(parsed).not.toHaveProperty("pdf_storage_path");
    expect(parsed).not.toHaveProperty("community_id");
  });
});

describe("membershipParamsSchema", () => {
  it("accepts slug + membershipId uuid", () => {
    expect(
      membershipParamsSchema.parse({ slug: "demo", membershipId: UUID })
    ).toEqual({
      slug: "demo",
      membershipId: UUID,
    });
  });

  it("rejects non-uuid membershipId", () => {
    expect(
      membershipParamsSchema.safeParse({
        slug: "demo",
        membershipId: "bad",
      }).success
    ).toBe(false);
  });
});

describe("membershipStatusPatchSchema", () => {
  it("only allows cancelled", () => {
    expect(membershipStatusPatchSchema.parse({ status: "cancelled" })).toEqual({
      status: "cancelled",
    });
    expect(
      membershipStatusPatchSchema.safeParse({ status: "active" }).success
    ).toBe(false);
  });
});

describe("inviteParamsSchema / invitePatchSchema", () => {
  it("accepts slug + inviteId uuid", () => {
    expect(inviteParamsSchema.parse({ slug: "demo", inviteId: UUID })).toEqual({
      slug: "demo",
      inviteId: UUID,
    });
  });

  it("only allows is_active false", () => {
    expect(invitePatchSchema.parse({ is_active: false })).toEqual({
      is_active: false,
    });
    expect(invitePatchSchema.safeParse({ is_active: true }).success).toBe(false);
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

  it("strips client priceId (price comes from DB only)", () => {
    expect(
      subscriptionCreateSchema.parse({
        communityId: UUID,
        priceId: "price_attacker",
      })
    ).toEqual({ communityId: UUID });
  });

  it("rejects non-uuid communityId", () => {
    expect(
      subscriptionCreateSchema.safeParse({ communityId: "x" }).success
    ).toBe(false);
  });
});

describe("subscriptionPortalSchema", () => {
  it("accepts communityId", () => {
    expect(subscriptionPortalSchema.parse({ communityId: UUID })).toEqual({
      communityId: UUID,
    });
  });

  it("rejects non-uuid communityId", () => {
    expect(
      subscriptionPortalSchema.safeParse({ communityId: "x" }).success
    ).toBe(false);
  });
});
