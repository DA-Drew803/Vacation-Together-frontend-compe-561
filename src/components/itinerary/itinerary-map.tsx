"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

export type ItineraryMapLocation = {
  id: string;
  dayNumber: number;
  title: string;
  location: string;
  latitude: number;
  longitude: number;
  estimatedCost: number;
};

const markerIcon = L.divIcon({
  className: "itinerary-map-marker",
  html: "<span></span>",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitMap({ locations }: { locations: ItineraryMapLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 13);
      return;
    }
    if (locations.length > 1) {
      map.fitBounds(
        locations.map((location) => [location.latitude, location.longitude] as [number, number]),
        { padding: [28, 28] },
      );
    }
  }, [locations, map]);
  return null;
}

export function ItineraryMap({ locations, selectedActivityId }: { locations: ItineraryMapLocation[]; selectedActivityId?: string | null }) {
  if (!locations.length) {
    return <div className="itinerary-map__empty">Verified map locations will appear here when the place provider returns coordinates.</div>;
  }

  return (
    <div className="itinerary-map" aria-label="Map of itinerary locations">
      <MapContainer center={[locations[0].latitude, locations[0].longitude]} zoom={12} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMap locations={locations} />
        {locations.map((location) => (
          <Marker key={location.id} position={[location.latitude, location.longitude]} icon={markerIcon} opacity={selectedActivityId && selectedActivityId !== location.id ? 0.5 : 1}>
            <Popup>
              <strong>DAY {String(location.dayNumber).padStart(2, "0")} · {location.title}</strong>
              <br />
              {location.location}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
