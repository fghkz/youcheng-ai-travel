import { z } from "zod";
import { finalPlanSchema, moodKeys, pageDocumentSchema, richTextDocumentSchema, themeKeys } from "@/lib/journey-types";

const uuid = z.string().uuid();

export const finalizePlanRequestSchema = z.object({
  content: finalPlanSchema.optional(),
  userRequest: z.string().trim().max(2000).optional().default(""),
  selectedSpotIds: z.array(z.string().min(1).max(200)).max(50).optional(),
});

export const startJourneyRequestSchema = z.object({
  sourceTripId: z.number().int().positive(),
  themeKey: z.enum(themeKeys).optional().default("cute"),
});

export const updateJourneyRequestSchema = z.object({
  revision: z.number().int().positive(),
  title: z.string().trim().min(1).max(100).optional(),
  summary: z.string().max(1000).optional(),
  companionLabel: z.string().max(80).optional(),
  closingMessage: z.string().max(1000).optional(),
  coverMediaId: uuid.nullable().optional(),
  themeKey: z.enum(themeKeys).optional(),
  status: z.enum(["planned", "in_progress", "completed"]).optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "revision"), "没有需要保存的修改");

export const generatePageRequestSchema = z.object({
  tone: z.enum(["daily", "couple", "family", "friends", "solo"]).optional().default("daily"),
  preserveLocked: z.boolean().optional().default(true),
});

export const savePageDocumentRequestSchema = z.object({
  revision: z.number().int().positive(),
  content: pageDocumentSchema,
});

export const createEntryRequestSchema = z.object({
  stopId: uuid.nullable().optional().default(null),
  title: z.string().trim().max(100).nullable().optional().default(null),
  body: richTextDocumentSchema,
  moodKey: z.enum(moodKeys).nullable().optional().default(null),
  moodText: z.string().max(160).nullable().optional().default(null),
  message: z.string().max(500).nullable().optional().default(null),
  happenedAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["draft", "ready"]).optional().default("ready"),
  isPublic: z.boolean().optional().default(true),
});

export const updateEntryRequestSchema = createEntryRequestSchema.partial().extend({
  revision: z.number().int().positive(),
}).refine((value) => Object.keys(value).some((key) => key !== "revision"), "没有需要保存的修改");

export const createUploadUrlRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

export const registerMediaRequestSchema = z.object({
  path: z.string().min(1).max(500),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
  width: z.number().int().positive().nullable().optional().default(null),
  height: z.number().int().positive().nullable().optional().default(null),
  entryId: uuid.nullable().optional().default(null),
  stopId: uuid.nullable().optional().default(null),
  caption: z.string().max(300).nullable().optional().default(null),
  altText: z.string().max(200).nullable().optional().default(null),
  sortOrder: z.number().int().min(1).max(9).optional().default(1),
});
