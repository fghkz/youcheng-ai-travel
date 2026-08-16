export type TransportPreference = "transit" | "driving" | "either";
export type TravelPace = "leisurely" | "comfortable" | "compact";
export type RouteMode = "transit" | "driving";
export type DataAvailability = "available" | "missing" | "uncertain";
export type ServiceMode = "live" | "demo" | "fallback";
export type ShortDescriptionSource = "deepseek" | "provider-truncated" | "missing";
export const HOTEL_ORIGIN_ID = "__hotel__";

export interface TripPreferences {
  destination: string;
  hotel: string;
  startFromHotel: boolean;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  transportPreference: TransportPreference;
  pace: TravelPace;
}

export interface ScenicSpot {
  id: string;
  name: string;
  location: { longitude: number; latitude: number };
  description: string | null;
  shortDescription: string | null;
  shortDescriptionSource: ShortDescriptionSource;
  address: string | null;
  images: string[];
  openingHours: string | null;
  openingHoursStatus: DataAvailability;
  referencePrice: string | null;
  priceStatus: DataAvailability;
  category: string;
  visual: string;
  source: "aliyun-scenic-api" | "demo";
}

export interface RouteOption {
  originSpotId: string;
  destinationSpotId: string;
  mode: RouteMode;
  durationMinutes: number | null;
  distanceMeters: number | null;
  summary: string | null;
  reachable: boolean;
  polyline: Array<{ longitude: number; latitude: number }>;
  source: "amap-api" | "demo";
}

export interface ItineraryItem {
  spotId: string;
  arrivalTime: string;
  visitStartTime: string;
  visitEndTime: string;
  suggestedVisitMinutes: number;
  visitDurationSource: "provider" | "ai-suggestion";
  routeFromPrevious: RouteOption | null;
}

export interface ItineraryDay {
  date: string;
  theme: string;
  items: ItineraryItem[];
  mealBreak?: {
    label: "午餐与休息";
    startTime: string;
    endTime: string;
    durationMinutes: number;
  } | null;
}

export interface UnscheduledSpot {
  spotId: string;
  reason: "insufficient_time" | "closed" | "unreachable" | "invalid_data";
  message: string;
}

export interface ItineraryResult {
  days: ItineraryDay[];
  unscheduledSpots: UnscheduledSpot[];
  warnings: string[];
}

export interface SourceMeta {
  scenic: ServiceMode;
  route?: ServiceMode;
  planner?: ServiceMode;
}

export interface ScenicSpotsResponse {
  spots: ScenicSpot[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
  };
  dataSources: SourceMeta;
  fallbackNotices: string[];
}

export interface ScenicSummary {
  spotId: string;
  text: string | null;
  source: ShortDescriptionSource;
}

export interface ScenicSummariesResponse {
  summaries: ScenicSummary[];
  dataSources: { planner: ServiceMode };
  fallbackNotices: string[];
}

export interface ItineraryResponse {
  itinerary: ItineraryResult;
  dataSources: SourceMeta;
  fallbackNotices: string[];
}

export interface ApiErrorResponse {
  error: { code: string; message: string; retryable: boolean };
}

export interface SaveTripResponse {
  trip: { id: number; title: string };
}
