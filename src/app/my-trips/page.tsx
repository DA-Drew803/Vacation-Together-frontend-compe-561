"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listTrips, type Trip } from "@/lib/api/trip";
import { getAccessToken } from "@/lib/auth/session";

export default function MyTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    void listTrips()
      .then(setTrips)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load trips.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="my-trips-page">
      <SiteHeader />
      <div className="my-trips-shell">
        <div
          className="my-trips-banner"
          role="img" aria-label="Friends enjoying a trip together"
        />
        <section
          className="my-trips-content"
          aria-labelledby="my-trips-heading"
        >
          <div className="my-trips-intro">
            <p className="eyebrow">MY TRIPS</p>
            <h1 id="my-trips-heading">Your trips.</h1>
            <p>Keep every group trip in one place.</p>
          </div>

          {loading ? (
            <p className="my-trips-notice" role="status">
              Loading trips...
            </p>
          ) : !getAccessToken() ? (
            <p className="my-trips-notice">
              Please{" "}
              <Link className="text-link" href="/login?next=/my-trips">
                log in
              </Link>{" "}
              to see your trips.
            </p>
          ) : error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : trips.length === 0 ? (
            <p className="my-trips-notice">
              You have no trips yet. Start one with your group.
            </p>
          ) : (
            <div className="my-trips-list">
              {trips.map((trip) => (
                <Link
                  className="my-trip-link"
                  key={trip.id}
                  href={`/trips/${encodeURIComponent(trip.id)}/plan`}
                  aria-label={`Open ${trip.name}`}
                >
                  <Card className="my-trip-card">
                    <CardHeader className="my-trip-card-header">
                      <CardTitle className="my-trip-card-title">{trip.name}</CardTitle>
                      <CardDescription className="my-trip-card-meta">
                        {trip.state.replaceAll("_", " ").toLowerCase()}
                      </CardDescription>
                    </CardHeader>
                    <span className="my-trip-card-action">
                      OPEN TRIP <span aria-hidden="true">→</span>
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          <Link className="my-trips-create" href="/trips">
            CREATE A NEW TRIP
          </Link>
        </section>
      </div>
    </main>
  );
}
