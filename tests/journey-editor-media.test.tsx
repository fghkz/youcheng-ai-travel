import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JourneyEditor } from "@/components/journey-editor";

const document = {
  version: 1 as const,
  hero: { title: "杭州手记", subtitle: "", companionLabel: "" },
  intro: { text: "旅行记录" },
  blocks: [],
  closing: { text: "" },
  visibility: { showDates: true, showCompanions: true },
};

afterEach(() => localStorage.clear());

describe("journey editor media controls", () => {
  it("keeps cover upload and photo wall available when the journey has no media", () => {
    render(<JourneyEditor
      journey={{
        id: "f48fc845-681a-40dc-bc96-b7b60fe50cc7", title: "杭州手记", summary: "", companion_label: "",
        closing_message: "", theme_key: "cute", visibility: "private", slug: "hangzhou-test-a1b2c3",
        cover_media_id: null, published_at: null, revision: 1, planned_start_date: "2026-08-21", planned_end_date: "2026-08-23",
      }}
      stops={[]}
      entries={[]}
      media={[]}
      document={document}
      documentRevision={1}
    />);

    expect(screen.getByRole("button", { name: "上传封面" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "照片墙" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeEnabled();
  });
});

