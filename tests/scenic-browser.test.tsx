import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScenicBrowser } from "@/components/scenic-browser";
import type { ScenicSpot } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function makeSpot(index: number): ScenicSpot {
  return {
    id: `spot-${index}`,
    name: `杭州景点${index}`,
    location: { longitude: 120 + index / 100, latitude: 30 + index / 100 },
    category: "目的地景点",
    visual: "杭",
    description: `这是杭州景点${index}的供应商完整介绍。`,
    shortDescription: `杭州景点${index}的简短介绍。`,
    shortDescriptionSource: "provider-truncated",
    address: `杭州市示例路${index}号`,
    images: [],
    openingHours: null,
    openingHoursStatus: "missing",
    referencePrice: null,
    priceStatus: "missing",
    source: "aliyun-scenic-api",
  };
}

const spots = Array.from({ length: 12 }, (_, index) => makeSpot(index + 1));

function renderBrowser() {
  const onSelectionChange = vi.fn();
  render(<ScenicBrowser
    viewer={null}
    destination="杭州"
    requestVersion={1}
    disabled={false}
    generationStage="idle"
    hasResult={false}
    onGenerate={vi.fn()}
    onSelectionChange={onSelectionChange}
    onCatalogChange={vi.fn()}
    onMetaChange={vi.fn()}
    onError={vi.fn()}
    onBrowseLoading={vi.fn()}
    onDestinationReset={vi.fn()}
  />);
  return { onSelectionChange };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("ScenicBrowser", () => {
  it("shows eight spots, keeps selection while changing batch, and opens an accessible detail dialog", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/scenic-summaries") {
        return new Response(JSON.stringify({
          summaries: spots.slice(0, 8).map((spot) => ({ spotId: spot.id, text: spot.shortDescription, source: "deepseek" })),
          fallbackNotices: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        spots,
        pagination: { currentPage: 1, totalPages: 1, totalItems: spots.length, pageSize: 20 },
        dataSources: { scenic: "live", route: "live", planner: "live" },
        fallbackNotices: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const { onSelectionChange } = renderBrowser();
    await screen.findByText("杭州景点1");
    expect(screen.getAllByRole("img", { name: /暂无供应商图片/ })).toHaveLength(8);
    expect(screen.getAllByText("暂无供应商图片")).toHaveLength(8);
    expect(screen.queryByText("杭州景点9")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "加入行程" })).toHaveLength(8);

    fireEvent.click(screen.getAllByRole("button", { name: "加入行程" })[0]);
    expect(onSelectionChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: "spot-1" })]);

    fireEvent.click(screen.getByRole("button", { name: /换一批/ }));
    await screen.findByText("杭州景点9");
    expect(screen.getByText("杭州景点1")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "查看详情" })[0]);
    const dialog = screen.getByRole("dialog", { name: "杭州景点9" });
    expect(within(dialog).getByText("这是杭州景点9的供应商完整介绍。")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });
});
