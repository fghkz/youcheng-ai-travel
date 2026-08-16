import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const tripPreferencesSchema = z
  .object({
    destination: z.string().trim().min(1, "请输入目的地").max(40, "目的地不能超过 40 个字符"),
    hotel: z.string().trim().max(100, "酒店名称或地址不能超过 100 个字符").optional().default(""),
    startFromHotel: z.boolean().optional().default(false),
    startDate: z.string().regex(datePattern, "请选择有效的开始日期"),
    endDate: z.string().regex(datePattern, "请选择有效的结束日期"),
    dailyStartTime: z.string().regex(timePattern, "请选择有效的开始时间"),
    dailyEndTime: z.string().regex(timePattern, "请选择有效的结束时间"),
    transportPreference: z.enum(["transit", "driving", "either"]),
    pace: z.enum(["leisurely", "comfortable", "compact"]).optional().default("comfortable"),
  })
  .superRefine((value, context) => {
    if (value.startFromHotel && !value.hotel) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["hotel"], message: "选择从酒店出发时，请先填写入住酒店" });
    }
    if (value.endDate < value.startDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "结束日期不能早于开始日期" });
    }
    if (value.dailyEndTime <= value.dailyStartTime) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["dailyEndTime"], message: "结束时间必须晚于开始时间" });
    }
    const start = new Date(`${value.startDate}T00:00:00`);
    const end = new Date(`${value.endDate}T00:00:00`);
    if ((end.getTime() - start.getTime()) / 86_400_000 > 14) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "第一版最多规划 15 天行程" });
    }
  });

export const scenicSpotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.object({ longitude: z.number().finite(), latitude: z.number().finite() }),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  shortDescriptionSource: z.enum(["deepseek", "provider-truncated", "missing"]),
  address: z.string().nullable(),
  images: z.array(z.string().url()).max(12),
  openingHours: z.string().nullable(),
  openingHoursStatus: z.enum(["available", "missing", "uncertain"]),
  referencePrice: z.string().nullable(),
  priceStatus: z.enum(["available", "missing", "uncertain"]),
  category: z.string(),
  visual: z.string(),
  source: z.enum(["aliyun-scenic-api", "demo"]),
});

export const scenicSearchRequestSchema = z.object({
  destination: z.string().trim().min(1).max(40),
  query: z.string().trim().max(50).optional().default(""),
  page: z.number().int().min(1).max(100).optional().default(1),
});

export const scenicSummariesRequestSchema = z.object({
  spots: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    description: z.string().max(12_000).nullable(),
  })).min(1).max(8),
});

export const itineraryRequestSchema = z.object({
  preferences: tripPreferencesSchema,
  spots: z.array(scenicSpotSchema).min(1, "请至少选择一个景点").max(8, "单次最多选择 8 个景点"),
});

export const routeOptionSchema = z.object({
  originSpotId: z.string(),
  destinationSpotId: z.string(),
  mode: z.enum(["transit", "driving"]),
  durationMinutes: z.number().int().positive().nullable(),
  distanceMeters: z.number().nonnegative().nullable(),
  summary: z.string().nullable(),
  reachable: z.boolean(),
  polyline: z.array(z.object({
    longitude: z.number().finite(),
    latitude: z.number().finite(),
  })).max(20_000).optional().default([]),
  source: z.enum(["amap-api", "demo"]),
});

export const itineraryResultSchema = z.object({
  days: z.array(z.object({
    date: z.string().regex(datePattern),
    theme: z.string(),
    mealBreak: z.object({
      label: z.literal("午餐与休息"),
      startTime: z.string().regex(timePattern),
      endTime: z.string().regex(timePattern),
      durationMinutes: z.number().int().min(60).max(120),
    }).nullable().optional().default(null),
    items: z.array(z.object({
      spotId: z.string(),
      arrivalTime: z.string().regex(timePattern),
      visitStartTime: z.string().regex(timePattern),
      visitEndTime: z.string().regex(timePattern),
      suggestedVisitMinutes: z.number().int().positive(),
      visitDurationSource: z.enum(["provider", "ai-suggestion"]),
      routeFromPrevious: routeOptionSchema.nullable(),
    })),
  })),
  unscheduledSpots: z.array(z.object({
    spotId: z.string(),
    reason: z.enum(["insufficient_time", "closed", "unreachable", "invalid_data"]),
    message: z.string(),
  })),
  warnings: z.array(z.string()),
});

const sourceMetaSchema = z.object({
  scenic: z.enum(["live", "demo", "fallback"]),
  route: z.enum(["live", "demo", "fallback"]).optional(),
  planner: z.enum(["live", "demo", "fallback"]).optional(),
});

export const saveTripRequestSchema = z.object({
  preferences: tripPreferencesSchema,
  spots: z.array(scenicSpotSchema).min(1).max(8),
  result: z.object({
    itinerary: itineraryResultSchema,
    dataSources: sourceMetaSchema,
    fallbackNotices: z.array(z.string()).max(20),
  }),
});
