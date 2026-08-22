import { describe, expect, it } from "vitest";
import { createUploadUrlRequestSchema, updateJourneyRequestSchema } from "../lib/journey-schemas";
import { finalPlanSchema, pageDocumentSchema, themeKeys } from "../lib/journey-types";

const baseDocument = {
  version: 1 as const,
  hero: { title: "大理的春天", subtitle: "慢慢走", companionLabel: "我们" },
  intro: { text: "从洱海边开始。" },
  blocks: [
    { id: "intro-1", type: "text" as const, heading: "第一站", text: "风吹过来。", hidden: false, locked: true, source: "user" as const },
  ],
  closing: { text: "下次见。" },
  visibility: { showDates: true, showCompanions: true },
};

describe("Journey 2.0 structured schemas", () => {
  it("ships the four required themes", () => {
    expect(themeKeys).toEqual(["cute", "nostalgic", "joyful", "elegant"]);
  });

  it("accepts a controlled page document and strips event-like fields", () => {
    const parsed = pageDocumentSchema.parse({
      ...baseDocument,
      blocks: [{ ...baseDocument.blocks[0], onClick: "alert(1)", html: "<script>alert(1)</script>" }],
    });
    expect(parsed.blocks[0]).not.toHaveProperty("onClick");
    expect(parsed.blocks[0]).not.toHaveProperty("html");
  });

  it("rejects executable block types and duplicate stable ids", () => {
    expect(pageDocumentSchema.safeParse({ ...baseDocument, blocks: [{ id: "x", type: "script", code: "alert(1)" }] }).success).toBe(false);
    expect(pageDocumentSchema.safeParse({ ...baseDocument, blocks: [baseDocument.blocks[0], baseDocument.blocks[0]] }).success).toBe(false);
  });

  it("validates the finalized plan shape and time fields", () => {
    const plan = finalPlanSchema.parse({
      days: [{ date: "2026-09-12", theme: "抵达", items: [{
        spotId: "erhai", placeName: "洱海", arrivalTime: "09:00", visitStartTime: "09:10", visitEndTime: "11:30",
        selected: true, transport: "步行", accommodation: "", budget: "100", reminder: "防晒", notes: "", routeFromPrevious: null,
      }] }],
    });
    expect(plan.days[0].items[0].placeName).toBe("洱海");
    expect(finalPlanSchema.safeParse({ ...plan, days: [{ ...plan.days[0], date: "12/09/2026" }] }).success).toBe(false);
  });

  it("enforces optimistic revisions and the 10 MB upload limit", () => {
    expect(updateJourneyRequestSchema.safeParse({ revision: 1 }).success).toBe(false);
    expect(updateJourneyRequestSchema.safeParse({ revision: 1, themeKey: "elegant" }).success).toBe(true);
    expect(createUploadUrlRequestSchema.safeParse({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 10 * 1024 * 1024 }).success).toBe(true);
    expect(createUploadUrlRequestSchema.safeParse({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });
});
