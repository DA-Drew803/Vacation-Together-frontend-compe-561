"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetchBlob } from "@/lib/api/client";

export type ItineraryMapLocation = {
  id: string;
  dayNumber: number;
  title: string;
  purpose?: string;
  placeId?: string;
  about?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  reviews?: Array<{ text: string; author?: string; rating?: number; relativeTime?: string }>;
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
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const lastMarkerSelection = useRef<string | null>(null);
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedActivityId) ?? null,
    [locations, selectedActivityId],
  );
  const previewLocation = useMemo(
    () => locations.find((location) => location.id === selectedMapPlaceId)
      ?? selectedLocation
      ?? locations[0]
      ?? null,
    [locations, selectedMapPlaceId, selectedLocation],
  );

  useEffect(() => {
    const updateTheme = () => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

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
        center: { lat: 0, lng: 0 },
        zoom: 12,
        mapId,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        gestureHandling: "cooperative",
        colorScheme: theme === "dark" ? "DARK" : "LIGHT",
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
  }, [theme]);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current.clear();

    const bounds = new google.maps.LatLngBounds();
    locations.forEach((location) => {
      const marker = new google.maps.Marker({
        map: map.current,
        position: { lat: location.latitude, lng: location.longitude },
        title: location.title,
        label: { text: String(location.dayNumber), color: "#1b211e", fontWeight: "700", fontSize: "11px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: "#d3a935",
          fillOpacity: 1,
          strokeColor: "#f8f6f0",
          strokeWeight: 2,
        },
        zIndex: 1,
      });
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
  }, [locations, onMapSelectActivity, mapReady]);

  useEffect(() => {
    const locationsById = new Map(locations.map((location) => [location.id, location]));
    markers.current.forEach((marker, id) => {
      const location = locationsById.get(id);
      if (!location) return;
      const hovered = location.id === hoveredActivityId;
      const markerSelected = location.id === selectedMapPlaceId
        || (!selectedMapPlaceId && location.id === selectedActivityId);
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: markerSelected || hovered ? 14 : 11,
        fillColor: markerSelected ? "#f5c84b" : hovered ? "#e3b83e" : "#d3a935",
        fillOpacity: 1,
        strokeColor: "#f8f6f0",
        strokeWeight: markerSelected ? 3 : 2,
      });
      marker.setZIndex(markerSelected ? 3 : hovered ? 2 : 1);
    });
  }, [locations, selectedActivityId, selectedMapPlaceId, hoveredActivityId, mapReady]);

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
      {previewLocation ? <aside className="itinerary-map__preview" aria-live="polite"><ActivityPreview location={previewLocation} /></aside> : <aside className="itinerary-map__preview itinerary-map__preview--empty"><p className="eyebrow">SELECT A PLACE ON THE MAP</p></aside>}
    </div>
  );
}

function ActivityPreview({ location }: { location: ItineraryMapLocation }) {
  return (
    <>
      <ActivityPreviewPhoto key={location.photoUrl ?? location.id} photoUrl={location.photoUrl} title={location.title} />
      <div className="itinerary-map__preview-copy">
        <p className="eyebrow">DAY {String(location.dayNumber).padStart(2, "0")}</p>
        {location.purpose && <p className="activity-purpose">{location.purpose}</p>}
        <h4>{location.title}</h4>
        {location.rating !== undefined && <p className="itinerary-place-rating">★ {location.rating.toFixed(1)}{location.ratingCount ? ` · ${location.ratingCount.toLocaleString()} reviews` : ""}</p>}
        {location.location && <p className="itinerary-place-address">{location.location}</p>}
        {location.about && <section className="itinerary-map__overview-section"><p className="eyebrow">ABOUT</p><p className="itinerary-map__overview-copy">{location.about}</p></section>}
        {location.reviews?.length ? <section className="itinerary-map__overview-section"><p className="eyebrow">WHAT TRAVELERS SAY</p><div className="itinerary-map__reviews">{location.reviews.map((review, index) => <blockquote key={`${review.author ?? "review"}-${index}`}><span className="itinerary-map__review-stars">{"★".repeat(Math.max(1, Math.min(5, Math.round(review.rating ?? 5))))}</span><p>“{review.text}”</p>{review.author && <cite>— {review.author}</cite>}</blockquote>)}</div></section> : null}
        <div className="itinerary-map__overview-links"><p className="eyebrow">OFFICIAL / USEFUL LINKS</p>{location.websiteUri && <a href={location.websiteUri} target="_blank" rel="noreferrer">OFFICIAL WEBSITE →</a>}<a href={location.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.title)}${location.placeId ? `&query_place_id=${encodeURIComponent(location.placeId)}` : ""}`} target="_blank" rel="noreferrer">VIEW ON GOOGLE MAPS →</a></div>
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
