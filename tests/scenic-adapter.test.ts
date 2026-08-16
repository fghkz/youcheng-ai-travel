import { describe, expect, it } from "vitest";
import { normalizeAliyunScenicPage, normalizeAliyunScenicResponse } from "@/lib/services/scenic";

describe("Aliyun scenic adapter", () => {
  it("maps documented scenic fields without inventing missing facts", () => {
    const result = normalizeAliyunScenicResponse({
      code: 200,
      msg: "成功",
      data: {
        list: [{
          id: "10612",
          name: "大士岩",
          summary: "景点描述",
          opentime: "",
          location: { lon: "117.18797330", lat: "34.25199824" },
          picList: [],
        }],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "aliyun-10612",
      name: "大士岩",
      description: "景点描述",
      openingHours: null,
      openingHoursStatus: "missing",
      referencePrice: null,
      priceStatus: "missing",
      source: "aliyun-scenic-api",
    });
  });

  it("ignores expired ticket prices and keeps current reference prices uncertain", () => {
    const result = normalizeAliyunScenicResponse({
      code: 200,
      data: { list: [{
        id: "1", name: "示例景点", opentime: "09:00—17:00", location: { lon: "120", lat: "30" },
        picList: [{ entityList: [
          { AmountAdvice: "80", TicketName: "过期票", EndDate: "2015-12-31" },
          { AmountAdvice: "100", TicketName: "成人票", EndDate: "2099-12-31" },
        ] }],
      }] },
    });
    expect(result[0].referencePrice).toBe("成人票 · ¥100");
    expect(result[0].priceStatus).toBe("uncertain");
  });

  it("rejects upstream error codes", () => {
    expect(() => normalizeAliyunScenicResponse({ code: 400, msg: "参数错误" })).toThrow("参数错误");
  });

  it("decodes HTML entities and rejects unrelated hotel packages", () => {
    const result = normalizeAliyunScenicResponse({
      code: 200,
      data: { list: [{
        id: "2", name: "杭州西湖", opentime: "07:00&mdash;18:00", location: { lon: "120", lat: "30" },
        picList: [{ entityList: [{ AmountAdvice: "298", TicketName: "西溪湿地附近酒店套餐", EndDate: "2099-12-31" }] }],
      }] },
    });
    expect(result[0].openingHours).toBe("07:00—18:00");
    expect(result[0].referencePrice).toBeNull();
  });

  it("extracts only HTTPS images and never treats ticket entities as pictures", () => {
    const result = normalizeAliyunScenicResponse({
      code: 200,
      data: { list: [{
        id: "3", name: "示例景点", location: { lon: "120", lat: "30" },
        priceList: [
          "https://cdn.example.com/scenic-1.jpg",
          { imageUrl: "https://cdn.example.com/scenic-2.webp" },
          { imageUrl: "https://cdn.example.com/scenic-3.png" },
          { imageUrl: "http://unsafe.example.com/scenic.jpg" },
          { entityList: [{ TicketName: "https://not-an-image.example/ticket.jpg", AmountAdvice: "10" }] },
        ],
        picList: [{ src: "https://cdn.example.com/scenic-1.jpg" }],
      }] },
    });
    expect(result[0].images).toEqual([
      "https://cdn.example.com/scenic-1.jpg",
      "https://cdn.example.com/scenic-2.webp",
    ]);
  });

  it("maps pagination and filters a named search to the destination scope", () => {
    const result = normalizeAliyunScenicPage({
      code: 200,
      data: {
        allNum: "45", currentPage: "2", maxResult: "20",
        list: [
          { id: "hz", name: "西湖景区", cityName: "杭州", location: { lon: "120", lat: "30" } },
          { id: "dl", name: "大理西湖", cityName: "大理", location: { lon: "100", lat: "25" } },
        ],
      },
    }, "杭州", "西湖");
    expect(result.spots.map((spot) => spot.id)).toEqual(["aliyun-hz"]);
    expect(result.pagination).toEqual({ currentPage: 2, totalPages: 3, totalItems: 45, pageSize: 20 });
  });
});
