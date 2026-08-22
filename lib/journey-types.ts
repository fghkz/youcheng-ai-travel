import { z } from "zod";

export const themeKeys = ["cute", "nostalgic", "joyful", "elegant"] as const;
export const moodKeys = ["excited", "happy", "peaceful", "tired", "surprised", "moved"] as const;

export type ThemeKey = (typeof themeKeys)[number];
export type MoodKey = (typeof moodKeys)[number];
export type JourneyStatus = "planned" | "in_progress" | "completed";
export type JourneyVisibility = "private" | "public";
export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

const safeText = (max: number) => z.string().max(max);
const blockBase = z.object({
  id: z.string().min(1).max(80),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  source: z.enum(["ai", "user"]).default("ai"),
});

export const pageBlockSchema = z.discriminatedUnion("type", [
  blockBase.extend({ type: z.literal("text"), heading: safeText(100).default(""), text: safeText(4000) }),
  blockBase.extend({ type: z.literal("gallery"), mediaIds: z.array(z.string().uuid()).max(30), caption: safeText(300).default("") }),
  blockBase.extend({ type: z.literal("mood"), moodKey: z.enum(moodKeys), text: safeText(500) }),
  blockBase.extend({ type: z.literal("message"), text: safeText(1000) }),
  blockBase.extend({ type: z.literal("quote"), text: safeText(500), attribution: safeText(100).default("") }),
  blockBase.extend({ type: z.literal("divider") }),
]);

export const pageDocumentSchema = z.object({
  version: z.literal(1),
  hero: z.object({
    title: z.string().trim().min(1).max(100),
    subtitle: safeText(240).default(""),
    companionLabel: safeText(80).default(""),
  }),
  intro: z.object({ text: safeText(3000) }),
  blocks: z.array(pageBlockSchema).max(100),
  closing: z.object({ text: safeText(1000) }),
  visibility: z.object({ showDates: z.boolean(), showCompanions: z.boolean() }),
}).superRefine((document, context) => {
  const ids = new Set<string>();
  document.blocks.forEach((block, index) => {
    if (ids.has(block.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocks", index, "id"], message: "内容块 ID 不能重复" });
    ids.add(block.id);
  });
});

export const richTextDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.object({ type: z.literal("paragraph"), text: z.string().max(6000) })).max(30),
});

export const finalPlanItemSchema = z.object({
  spotId: z.string().min(1).max(200),
  placeName: z.string().trim().min(1).max(120),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  visitStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  visitEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  selected: z.boolean().default(true),
  transport: safeText(300).default(""),
  accommodation: safeText(300).default(""),
  budget: safeText(120).default(""),
  reminder: safeText(500).default(""),
  notes: safeText(2000).default(""),
  routeFromPrevious: z.unknown().nullable().default(null),
});

export const finalPlanSchema = z.object({
  days: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    theme: z.string().trim().min(1).max(120),
    notes: safeText(2000).default(""),
    items: z.array(finalPlanItemSchema).max(30),
  })).min(1).max(30),
  warnings: z.array(z.string().max(500)).max(30).default([]),
  userRequest: safeText(2000).default(""),
});

export type PageDocumentV1 = z.infer<typeof pageDocumentSchema>;
export type PageBlock = z.infer<typeof pageBlockSchema>;
export type FinalPlan = z.infer<typeof finalPlanSchema>;

export interface JourneyRecord {
  id: string;
  ownerId: string;
  sourceTripId: number;
  title: string;
  summary: string;
  companionLabel: string;
  closingMessage: string;
  status: JourneyStatus;
  visibility: JourneyVisibility;
  themeKey: ThemeKey;
  slug: string;
  plannedStartDate: string;
  plannedEndDate: string;
  publishedAt: string | null;
  revision: number;
  updatedAt: string;
}

export interface JourneyStopRecord {
  id: string;
  journeyId: string;
  dayNumber: number;
  sortOrder: number;
  plannedDate: string;
  plannedTime: string | null;
  actualArrivedAt: string | null;
  placeName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isExtraStop: boolean;
  isPublic: boolean;
}

export interface JournalEntryRecord {
  id: string;
  journeyId: string;
  stopId: string | null;
  title: string | null;
  body: z.infer<typeof richTextDocumentSchema>;
  moodKey: MoodKey | null;
  moodText: string | null;
  message: string | null;
  happenedAt: string;
  status: "draft" | "ready";
  isPublic: boolean;
  revision: number;
}

export interface JournalMediaRecord {
  id: string;
  journeyId: string;
  entryId: string | null;
  stopId: string | null;
  storagePath: string;
  mimeType: string;
  caption: string | null;
  altText: string | null;
  sortOrder: number;
  signedUrl?: string;
}

export const themeMeta: Record<ThemeKey, { name: string; description: string; layoutName: string; layoutKey: string }> = {
  cute: { name: "可爱", description: "奶油色、贴纸与圆角手账", layoutName: "手账剪贴簿", layoutKey: "scrapbook" },
  nostalgic: { name: "沧桑怀旧", description: "胶片、旧纸与明信片质感", layoutName: "胶片旅行档案", layoutKey: "archive" },
  joyful: { name: "活泼快乐", description: "明亮色块与跳跃照片排版", layoutName: "快乐旅行杂志", layoutKey: "magazine" },
  elegant: { name: "温婉典雅", description: "黛青、米白与克制留白", layoutName: "艺术旅行书", layoutKey: "monograph" },
};

export const moodMeta: Record<MoodKey, { label: string; emoji: string }> = {
  excited: { label: "兴奋", emoji: "🤩" },
  happy: { label: "开心", emoji: "😊" },
  peaceful: { label: "平静", emoji: "😌" },
  tired: { label: "疲惫", emoji: "😮‍💨" },
  surprised: { label: "惊喜", emoji: "😮" },
  moved: { label: "感动", emoji: "🥹" },
};
