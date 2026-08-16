import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DestinationMapPicker, destinationFromAddress } from "@/components/destination-map-picker";

afterEach(() => {
  document.body.style.overflow = "";
  window.AMap = undefined;
});

describe("destination map picker", () => {
  it("derives a scenic-query city name from normal cities and municipalities", () => {
    expect(destinationFromAddress({ province: "浙江省", city: "杭州市", district: "西湖区" })).toBe("杭州");
    expect(destinationFromAddress({ province: "北京市", city: [], district: "朝阳区" })).toBe("北京");
  });

  it("shows a safe configuration state when the JS API key is missing", async () => {
    const onClose = vi.fn();
    render(<DestinationMapPicker apiKey="" initialDestination="杭州" onClose={onClose} onConfirm={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "点击地图，选择想去的城市" })).toBeInTheDocument();
    expect(screen.getByText("等待配置高德 JS API")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用这个城市" })).toBeDisabled();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("loads destination plugins when the base AMap runtime was loaded by another map", async () => {
    class FakeMap {
      addControl() {}
      destroy() {}
      on() {}
      setCenter() {}
      setCity() {}
      setZoom() {}
    }
    class FakeGeocoder {
      getAddress() {}
      getLocation(_address: string, callback: (status: string, result: object) => void) {
        callback("complete", { info: "OK", geocodes: [] });
      }
    }
    class FakeToolBar {}
    const amap: {
      Map: typeof FakeMap;
      Marker: typeof FakeToolBar;
      Geocoder: typeof FakeGeocoder | undefined;
      ToolBar: typeof FakeToolBar | undefined;
      plugin: ReturnType<typeof vi.fn>;
    } = {
      Map: FakeMap,
      Marker: FakeToolBar,
      Geocoder: undefined,
      ToolBar: undefined,
      plugin: vi.fn((_names: string[], callback: () => void) => {
        amap.Geocoder = FakeGeocoder;
        amap.ToolBar = FakeToolBar;
        callback();
      }),
    };
    window.AMap = amap as unknown as NonNullable<typeof window.AMap>;

    render(<DestinationMapPicker apiKey="test-js-key" initialDestination="杭州" onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => expect(amap.plugin).toHaveBeenCalledWith(["AMap.Geocoder", "AMap.ToolBar"], expect.any(Function)));
    expect(screen.queryByText("AMap.Geocoder is not a constructor")).not.toBeInTheDocument();
  });
});
