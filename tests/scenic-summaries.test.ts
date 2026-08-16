import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeScenicSpots } from "@/lib/services/summaries";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("scenic summary service", () => {
  it("batches descriptions into the documented DeepSeek JSON mode request", async () => {
    vi.stubEnv("APP_DATA_MODE", "live");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ summaries: [
        { spotId: "a", text: "忠实压缩后的景点简介。" },
        { spotId: "b", text: "另一条忠实压缩后的景点简介。" },
      ] }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await summarizeScenicSpots([
      { id: "a", name: "景点 A", description: "景点 A 的供应商原始介绍。" },
      { id: "b", name: "景点 B", description: "景点 B 的供应商原始介绍。" },
    ]);

    expect(result.dataSources.planner).toBe("live");
    expect(result.summaries.every((summary) => summary.source === "deepseek")).toBe(true);
    const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(request).toMatchObject({
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    });
    expect(request.messages[1].content).toContain("不得增加历史事实");
  });

  it("falls back to provider truncation when DeepSeek fails", async () => {
    vi.stubEnv("APP_DATA_MODE", "live");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    const longText = "这是一段只来自供应商的景点介绍。".repeat(20);

    const result = await summarizeScenicSpots([{ id: "a", name: "景点 A", description: longText }]);

    expect(result.dataSources.planner).toBe("fallback");
    expect(result.summaries[0].source).toBe("provider-truncated");
    expect(result.summaries[0].text?.length).toBeLessThanOrEqual(101);
    expect(result.fallbackNotices).toHaveLength(1);
  });
});
