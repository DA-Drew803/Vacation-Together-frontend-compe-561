"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetchBlob } from "@/lib/api/client";

export type ItineraryMapLocation = {
  id: string;
  dayNumber: number;
  title: string;
  location?: string;
  latitude: number;
  longitude: number;
  estimatedCost: number;
  photoUrl?: string | null;
  rating?: number;
  ratingCount?: number;
};

type ItineraryMapProps = {
  locations: ItineraryMapLocation[];
  selectedActivityId?: string | null;
  hoveredActivityId?: string | null;
  onMapSelectActivity?: (activityId: string) => void;
};

const mapId = "vacation-together-itinerary-map";

export function ItineraryMap({ locations, selectedActivityId, hoveredActivityId, onMapSelectActivity }: ItineraryMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<Map<string, google.maps.Marker>>(new Map());
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hoveredMapPlaceId, setHoveredMapPlaceId] = useState<string | null>(null);
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null);
  const lastMarkerSelection = useRef<string | null>(null);
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedActivityId) ?? null,
    [locations, selectedActivityId],
  );
  const previewLocation = useMemo(
    () => locations.find((location) => location.id === hoveredMapPlaceId)
      ?? locations.find((location) => location.id === selectedMapPlaceId)
      ?? selectedLocation,
    [locations, hoveredMapPlaceId, selectedMapPlaceId, selectedLocation],
  );

  useEffect(() => {
    if (selectedActivityId !== lastMarkerSelection.current) {
      setSelectedMapPlaceId(null);
    }
    lastMarkerSelection.current = null;
  }, [selectedActivityId]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapElement.current) {
      setMapError("Google Maps is unavailable. Verified itinerary places remain available below.");
      return;
    }

    setOptions({ key: apiKey, v: "weekly" });
    let cancelled = false;
    const markerStore = markers.current;
    void importLibrary("maps").then(({ Map }) => {
      if (cancelled || !mapElement.current) return;
      map.current = new Map(mapElement.current, {
        center: locations[0]
          ? { lat: locations[0].latitude, lng: locations[0].longitude }
          : { lat: 0, lng: 0 },
        zoom: 12,
        mapId,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        gestureHandling: "cooperative",
        colorScheme: document.documentElement.dataset.theme === "dark" ? "DARK" : "LIGHT",
      });
      setMapReady(true);
    }).catch(() => {
      if (!cancelled) setMapError("Google Maps could not be loaded. The itinerary remains usable.");
    });

    return () => {
      cancelled = true;
      markerStore.forEach((marker) => marker.setMap(null));
      markerStore.clear();
      map.current = null;
      setMapReady(false);
    };
  }, [locations]);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current.clear();

    const bounds = new google.maps.LatLngBounds();
    locations.forEach((location) => {
      const selected = location.id === selectedActivityId;
      const hovered = location.id === hoveredActivityId || location.id === hoveredMapPlaceId;
      const marker = new google.maps.Marker({
        map: map.current,
        position: { lat: location.latitude, lng: location.longitude },
        title: location.title,
        label: { text: String(location.dayNumber), color: "#1b211e", fontWeight: "700", fontSize: "11px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected || hovered ? 14 : 11,
          fillColor: selected ? "#f5c84b" : hovered ? "#e3b83e" : "#d3a935",
          fillOpacity: 1,
          strokeColor: "#f8f6f0",
          strokeWeight: selected ? 3 : 2,
        },
        zIndex: selected ? 3 : hovered ? 2 : 1,
      });
      marker.addListener("mouseover", () => setHoveredMapPlaceId(location.id));
      marker.addListener("mouseout", () => setHoveredMapPlaceId((current) => current === location.id ? null : current));
      marker.addListener("click", () => {
        lastMarkerSelection.current = location.id;
        setSelectedMapPlaceId(location.id);
        onMapSelectActivity?.(location.id);
      });
      markers.current.set(location.id, marker);
      bounds.extend({ lat: location.latitude, lng: location.longitude });
    });

    if (locations.length === 1) {
      map.current.setCenter({ lat: locations[0].latitude, lng: locations[0].longitude });
      map.current.setZoom(14);
    } else if (locations.length > 1) {
      map.current.fitBounds(bounds, 42);
    }
  }, [locations, selectedActivityId, hoveredActivityId, hoveredMapPlaceId, onMapSelectActivity, mapReady]);

  useEffect(() => {
    if (!map.current || !selectedLocation) return;
    map.current.panTo({ lat: selectedLocation.latitude, lng: selectedLocation.longitude });
  }, [selectedLocation]);

  if (!locations.length) {
    return <div className="itinerary-map__empty">Verified map locations will appear here when the place provider returns coordinates.</div>;
  }

  return (
    <div className="itinerary-map-wrap">
      <div className="itinerary-map" aria-label="Google Map of itinerary locations">
        <div ref={mapElement} className="itinerary-map__canvas" />
        {mapError && <div className="itinerary-map__message">{mapError}</div>}
      </div>
      {previewLocation && <div className="itinerary-map__preview" aria-live="polite"><ActivityPreview location={previewLocation} /></div>}
    </div>
  );
}

function ActivityPreview({ location }: { location: ItineraryMapLocation }) {
  return (
    <>
      <ActivityPreviewPhoto key={location.photoUrl ?? location.id} photoUrl={location.photoUrl} title={location.title} />
      <div>
        <p className="eyebrow">DAY {String(location.dayNumber).padStart(2, "0")}</p>
        <h4>{location.title}</h4>
        {location.rating !== undefined && <p className="itinerary-place-rating">★ {location.rating.toFixed(1)}{location.ratingCount ? ` · ${location.ratingCount.toLocaleString()} reviews` : ""}</p>}
        {location.location && <p className="itinerary-place-address">{location.location}</p>}
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.title)}&query_place_id=${encodeURIComponent(location.id)}`} target="_blank" rel="noreferrer">VIEW ON GOOGLE MAPS</a>
      </div>
    </>
  );
}

function ActivityPreviewPhoto({ photoUrl, title }: { photoUrl?: string | null; title: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!photoUrl) return undefined;
    let cancelled = false;
    let currentUrl: string | null = null;
    void apiFetchBlob(photoUrl).then((blob) => {
      if (cancelled) return;
      currentUrl = URL.createObjectURL(blob);
      setObjectUrl(currentUrl);
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [photoUrl]);

  if (objectUrl && !failed) {
    // Google photo bytes are loaded through the authenticated backend proxy.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="itinerary-map__preview-photo" src={objectUrl} alt={`${title} place`} />;
  }
  return <div className="itinerary-map__preview-photo itinerary-map__preview-photo--empty">PLACE</div>;
}
