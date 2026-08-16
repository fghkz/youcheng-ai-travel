"use client";

import { useState } from "react";
import { MapPinned } from "lucide-react";
import { ItineraryRouteMap } from "@/components/itinerary-route-map";
import type { ItineraryDay, ScenicSpot } from "@/lib/types";

interface SavedItineraryRouteMapProps {
  apiKey: string;
  days: ItineraryDay[];
  spots: ScenicSpot[];
  hotel: string;
  startFromHotel: boolean;
}

export function SavedItineraryRouteMap({
  apiKey,
  days,
  spots,
  hotel,
  startFromHotel,
}: SavedItineraryRouteMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const routeCount = days.reduce(
    (total, day) => total + day.items.filter((item) => item.routeFromPrevious).length,
    0,
  );

  return (
    <>
      <section className="route-map-card">
        <h3><MapPinned size={15} />交通路线</h3>
        <p>在高德地图中查看每天的景点顺序、路线、距离和预计耗时。</p>
        <div>
          <span>{routeCount} 段路线</span>
          <span>{days.length} 天行程</span>
        </div>
        <button type="button" onClick={() => setIsOpen(true)} disabled={days.length === 0}>
          <MapPinned size={16} />查看地图路线
        </button>
      </section>
      {isOpen && (
        <ItineraryRouteMap
          apiKey={apiKey}
          days={days}
          spots={spots}
          hotel={hotel}
          startFromHotel={startFromHotel}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
