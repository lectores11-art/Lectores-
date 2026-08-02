import { z } from "zod";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export const bookUploadModeSchema = z.enum(["pdf", "catalog"]);

export const slugParamsSchema = z.object({
  slug: z.string().min(1).max(100),
});

export const bookParamsSchema = slugParamsSchema.extend({
  bookId: z.string().uuid(),
});

export const threadParamsSchema = slugParamsSchema.extend({
  threadId: z.string().uuid(),
});

export const inviteTokenParamsSchema = z.object({
  token: z.string().min(1).max(64),
});

export const bookUploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  mode: bookUploadModeSchema.default("pdf"),
});

/** Finalize after client uploaded cover/PDF directly to Supabase Storage. */
export const bookFinalizeUploadSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    author: z.string().trim().max(200).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    mode: bookUploadModeSchema.default("pdf"),
    coverStoragePath: z.string().trim().min(3).max(500),
    pdfStoragePath: z.string().trim().min(3).max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "pdf" && !data.pdfStoragePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pdfStoragePath required",
        path: ["pdfStoragePath"],
      });
    }
  });

export const readingProgressSchema = z.object({
  currentPage: z.number().int().min(0),
  progressPercent: z.number().min(0).max(100),
});

export const bookmarkSchema = z.object({
  pageNumber: z.number().int().min(0),
  label: z.string().trim().max(200).optional().nullable(),
});

export const forumThreadCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
});

export const forumPostCreateSchema = z.object({
  content: z.string().trim().min(1).max(10000),
});

export const forumThreadPatchSchema = z
  .object({
    action: z.literal("like").optional(),
    is_pinned: z.boolean().optional(),
    is_featured: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.action === "like" ||
      typeof data.is_pinned === "boolean" ||
      typeof data.is_featured === "boolean",
    { message: "invalid" }
  );

export const meetingCreateSchema = z.object({
  action: z.literal("create"),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  activeBookId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().min(1).max(50).optional(),
});

export const meetingTokenSchema = z.object({
  action: z.literal("token"),
  meetingId: z.string().uuid(),
});

export const meetingStartEndSchema = z.object({
  action: z.enum(["start", "end"]),
  meetingId: z.string().uuid(),
});

export const meetingActionSchema = z.discriminatedUnion("action", [
  meetingCreateSchema,
  meetingTokenSchema,
  meetingStartEndSchema,
]);

export const inviteJoinSchema = z.object({
  token: z.string().min(1).max(64),
});

export const subscriptionCreateSchema = z.object({
  communityId: z.string().uuid(),
  priceId: z.string().min(1).max(200).optional(),
});

export const subscriptionDeleteSchema = z.object({
  membershipId: z.string().uuid(),
});

export const platformCommunityCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ownerEmail: z.string().trim().email().max(320),
  description: z.string().trim().max(2000).optional().nullable(),
  monthlyPriceCents: z.number().int().min(0).max(10_000_000).optional(),
});
