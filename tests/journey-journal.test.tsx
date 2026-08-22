import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JourneyJournal } from "@/components/journey-journal";
import type { PageDocumentV1 } from "@/lib/journey-types";

const journey = {
  title: "杭州三日游",
  summary: "",
  companion_label: "和爸妈一起",
  closing_message: "",
  theme_key: "joyful",
  cover_media_id: null,
  planned_start_date: "2026-10-02",
  planned_end_date: "2026-10-04",
};

function renderJournal(intro: string) {
  const document: PageDocumentV1 = {
    version: 1,
    hero: { title: "杭州三日游", subtitle: "杭州", companionLabel: "和爸妈一起" },
    intro: { text: intro },
    blocks: [],
    closing: { text: "旅途平安" },
    visibility: { showDates: true, showCompanions: true },
  };
  return render(<JourneyJournal journey={journey} stops={[]} entries={[]} media={[]} document={document} preview />);
}

describe("journey journal headings", () => {
  it("shows the user's opening directly without decorative labels", () => {
    renderJournal("第一天的风很温柔，我们从西湖边慢慢出发。");

    expect(screen.getByText("第一天的风很温柔，我们从西湖边慢慢出发。")).toBeInTheDocument();
    expect(screen.queryByText("写在出发时")).not.toBeInTheDocument();
    expect(screen.queryByText("活泼快乐旅行手记")).not.toBeInTheDocument();
  });

  it("does not render the generic travel-record placeholder", () => {
    renderJournal("旅行记录");
    expect(screen.queryByText("旅行记录")).not.toBeInTheDocument();
  });
});
describe("journey journal theme structures", () => {
  const layouts = {
    cute: "scrapbook",
    nostalgic: "archive",
    joyful: "magazine",
    elegant: "monograph",
  } as const;
  const richDocument: PageDocumentV1 = {
    version: 1,
    hero: { title: "杭州三日游", subtitle: "风从西湖吹来", companionLabel: "和爸妈一起" },
    intro: { text: "这是一段属于我们的杭州记忆。" },
    blocks: [
      { id: "story-block", type: "text", heading: "晚风", text: "沿着湖边慢慢走。", hidden: false, locked: true, source: "user" },
      { id: "mood-block", type: "mood", moodKey: "moved", text: "想把这一刻留久一点。", hidden: false, locked: true, source: "user" },
      { id: "gallery-block", type: "gallery", mediaIds: ["33333333-3333-4333-8333-333333333333"], caption: "旅途相册", hidden: false, locked: true, source: "user" },
    ],
    closing: { text: "下次还要一起出发。" },
    visibility: { showDates: true, showCompanions: true },
  };
  const stops = [
    { id: "west-lake", place_name: "西湖", day_number: 1, planned_date: "2026-10-02" },
    { id: "lingyin", place_name: "灵隐寺", day_number: 2, planned_date: "2026-10-03" },
  ];
  const entries = [{
    id: "entry-1", stop_id: "west-lake", title: "湖边散步", body: { type: "doc", content: [{ type: "paragraph", text: "风很温柔。" }] },
    mood_key: "happy", mood_text: "轻松", message: "记住今天", status: "ready", is_public: true,
  }];
  const media = [
    { id: "11111111-1111-4111-8111-111111111111", stop_id: "west-lake", signedUrl: "https://example.com/cover.webp", caption: "封面" },
    { id: "22222222-2222-4222-8222-222222222222", stop_id: "west-lake", signedUrl: "https://example.com/west-lake.webp", caption: "西湖" },
    { id: "33333333-3333-4333-8333-333333333333", stop_id: "west-lake", signedUrl: "https://example.com/gallery.webp", caption: "相册" },
  ];

  for (const [theme, layout] of Object.entries(layouts)) {
    it(`${theme} uses its own layout without changing content order`, () => {
      const view = render(<JourneyJournal
        journey={{ ...journey, theme_key: theme, cover_media_id: "11111111-1111-4111-8111-111111111111" }}
        stops={stops}
        entries={entries}
        media={media}
        document={richDocument}
        preview
      />);
      const root = view.container.querySelector(".travel-journal");
      expect(root).toHaveAttribute("data-layout", layout);
      expect(view.container.querySelectorAll('[data-journal-anchor^="stop-"]')).toHaveLength(2);
      expect(Array.from(view.container.querySelectorAll("[data-journal-block]")).map((node) => node.getAttribute("data-journal-block")))
        .toEqual(["story-block", "mood-block", "gallery-block"]);
      expect(screen.getByText("风很温柔。")).toBeInTheDocument();
      expect(screen.getByText("下次还要一起出发。")).toBeInTheDocument();
      expect(view.container.querySelectorAll("img")).toHaveLength(3);
      if (theme === "cute") expect(view.container.querySelector("[data-parity]")).toBeInTheDocument();
      if (theme === "nostalgic") expect(view.container.querySelector("#archive-west-lake")).toBeInTheDocument();
      if (theme === "joyful") expect(view.container.querySelector("[data-featured]")).toBeInTheDocument();
      if (theme === "elegant") expect(view.container.querySelector("#chapter-west-lake")).toBeInTheDocument();
      view.unmount();
    });
  }
});