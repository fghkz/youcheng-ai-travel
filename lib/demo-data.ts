import type { ScenicSpot } from "./types";

type DemoSpot = Omit<ScenicSpot, "shortDescription" | "shortDescriptionSource" | "address" | "images">;

const hangzhou: DemoSpot[] = [
  {
    id: "hz-west-lake", name: "西湖风景名胜区", location: { longitude: 120.1488, latitude: 30.2422 },
    description: "一湖映双塔，苏堤春晓与曲院风荷串起杭州最经典的山水画卷。", openingHours: "全天开放",
    openingHoursStatus: "available", referencePrice: "免费开放，部分景点另收费", priceStatus: "uncertain",
    category: "自然风光", visual: "湖", source: "demo",
  },
  {
    id: "hz-lingyin", name: "灵隐寺", location: { longitude: 120.1017, latitude: 30.2408 },
    description: "千年古刹隐于北高峰下，飞来峰造像与古木幽径相映成趣。", openingHours: "07:30—17:30",
    openingHoursStatus: "available", referencePrice: "参考票价 ¥75", priceStatus: "uncertain",
    category: "人文古迹", visual: "禅", source: "demo",
  },
  {
    id: "hz-leifeng", name: "雷峰塔景区", location: { longitude: 120.1484, latitude: 30.2316 },
    description: "登塔远眺西湖全景，在夕照时分感受雷峰夕照的经典意境。", openingHours: "08:00—19:00",
    openingHoursStatus: "available", referencePrice: "参考票价 ¥40", priceStatus: "uncertain",
    category: "城市地标", visual: "塔", source: "demo",
  },
  {
    id: "hz-xixi", name: "西溪国家湿地公园", location: { longitude: 120.0649, latitude: 30.2735 },
    description: "河港交错、芦苇成片，乘摇橹船深入杭州难得的城市湿地。", openingHours: "08:00—17:30",
    openingHoursStatus: "available", referencePrice: null, priceStatus: "missing",
    category: "湿地公园", visual: "溪", source: "demo",
  },
  {
    id: "hz-longjing", name: "龙井村", location: { longitude: 120.1092, latitude: 30.2196 },
    description: "沿茶田小径缓步，感受群山环抱中的龙井茶乡与慢生活。", openingHours: null,
    openingHoursStatus: "missing", referencePrice: "免费开放", priceStatus: "available",
    category: "茶园漫步", visual: "茶", source: "demo",
  },
  {
    id: "hz-canal", name: "京杭大运河·拱宸桥", location: { longitude: 120.1421, latitude: 30.3196 },
    description: "从拱宸桥到桥西历史街区，沿河读懂杭州流动的城市记忆。", openingHours: "街区全天开放",
    openingHoursStatus: "available", referencePrice: "免费开放，游船另收费", priceStatus: "uncertain",
    category: "世界遗产", visual: "运", source: "demo",
  },
];

const beijing: DemoSpot[] = [
  { id: "bj-palace", name: "故宫博物院", location: { longitude: 116.397, latitude: 39.918 }, description: "沿中轴线阅读明清宫城。", openingHours: "08:30—17:00", openingHoursStatus: "available", referencePrice: null, priceStatus: "missing", category: "人文古迹", visual: "宫", source: "demo" },
  { id: "bj-summer", name: "颐和园", location: { longitude: 116.273, latitude: 39.999 }, description: "昆明湖与万寿山组成的皇家园林。", openingHours: "06:00—20:00", openingHoursStatus: "available", referencePrice: null, priceStatus: "missing", category: "皇家园林", visual: "园", source: "demo" },
  { id: "bj-temple", name: "天坛公园", location: { longitude: 116.41, latitude: 39.882 }, description: "经典的古代祭祀建筑群。", openingHours: "06:00—22:00", openingHoursStatus: "available", referencePrice: null, priceStatus: "missing", category: "历史建筑", visual: "坛", source: "demo" },
];

const shanghai: DemoSpot[] = [
  { id: "sh-bund", name: "外滩", location: { longitude: 121.49, latitude: 31.241 }, description: "沿黄浦江欣赏城市天际线。", openingHours: "全天开放", openingHoursStatus: "available", referencePrice: "免费开放", priceStatus: "available", category: "城市地标", visual: "滩", source: "demo" },
  { id: "sh-museum", name: "上海博物馆", location: { longitude: 121.475, latitude: 31.229 }, description: "系统了解中国古代艺术。", openingHours: null, openingHoursStatus: "missing", referencePrice: "免费预约", priceStatus: "uncertain", category: "博物馆", visual: "博", source: "demo" },
  { id: "sh-yuyuan", name: "豫园", location: { longitude: 121.492, latitude: 31.227 }, description: "江南园林与老城厢街巷相邻。", openingHours: "09:00—16:30", openingHoursStatus: "available", referencePrice: null, priceStatus: "missing", category: "江南园林", visual: "豫", source: "demo" },
];

export const demoCities = ["杭州", "北京", "上海"] as const;
const data = new Map<string, DemoSpot[]>([["杭州", hangzhou], ["杭州市", hangzhou], ["北京", beijing], ["北京市", beijing], ["上海", shanghai], ["上海市", shanghai]]);

export function getDemoSpots(destination: string): ScenicSpot[] {
  return structuredClone(data.get(destination.trim()) ?? []).map((spot) => ({
    ...spot,
    shortDescription: spot.description,
    shortDescriptionSource: spot.description ? "provider-truncated" as const : "missing" as const,
    address: null,
    images: [],
  }));
}
