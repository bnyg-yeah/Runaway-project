// src/components/HomeHub.tsx

/**
 * A client for the home page.
 * Since page.tsx is a server component, it cannot pass along the search input and click handlers since those must be run in the browser
 * This client holds the selected place and passes it to the feature cards (Weather, Photos, News) as a single property
 *
 * This will be able to add more cards later by reading the same selected place
 */

"use client";

import { useCallback, useState } from "react";
import Search, { Place } from "./Search";

import { useRouter, useSearchParams } from "next/navigation"; // for URL sync, explained at const router

export default function HomeHub() {
  //which place was selected?
  const [selected, setSelected] = useState<Place | null>(null);

  //so the URL can change, but it doesnt navigate away from the page and so we dont lose and component states like the selected city
  // this is sharable links where sharing that link will let another user see exactly what you have, and restoring states on reload
  const router = useRouter();
  const searchParams = useSearchParams();

  //Handle a user picking a city from Search
  const handleSelect = useCallback(
    (place: Place) => {
      // A) Set local state so feature cards can render immediately.
      setSelected(place);

      // B) Update the URL so the selection is shareable.
      //    We only store a friendly label (city/country), not coords, to keep URLs clean.
      //    If you want, we can also include lat/lon (for 0 re-geocode on reload).
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("city", place.city);
      params.set("country", place.country);
      // if you want coords too (readable but longer URLs), uncomment:
      // params.set("lat", String(place.latitude));
      // params.set("lon", String(place.longitude));
      // params.set("tz", place.timezone);
      router.replace(`/?${params.toString()}`);
    },
    [router, searchParams]
  );


  return (
    <section className="space-y-6">
      {/* Search box with suggestions. When a suggestion is chosen, we store it above. */}
      <Search onSelect={handleSelect} />

      {/* Debug panel so you can *see* what the hub is holding. Remove when ready. */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-black">Selection debug</h2>
        {selected ? (
          <div className="mt-2 text-sm text-gray-700">
            <div>
              <span className="font-medium">Place:</span> {selected.city}
              {selected.region ? `, ${selected.region}` : ""},{" "}
              {selected.country}
            </div>
            <div>
              <span className="font-medium">Coords:</span>{" "}
              {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
            </div>
            <div>
              <span className="font-medium">Timezone:</span> {selected.timezone}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No city selected yet. Choose one above.
          </p>
        )}
      </div>

      {/* Layout slots for current + upcoming MVP cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Weather card (we'll implement next) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-black">Weather</h3>
          <p className="text-sm text-gray-500">
            {selected
              ? "Next: call /api/weather with the selected lat/lon/tz."
              : "Select a city to load weather."}
          </p>
        </div>

        {/* Photos card placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-black">Photos</h3>
          <p className="text-sm text-gray-500">
            {selected
              ? 'Next: call /api/photos?query="<City, Country>" (Unsplash).'
              : "Select a city to load photos."}
          </p>
        </div>

        {/* News card placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-black">News</h3>
          <p className="text-sm text-gray-500">
            {selected
              ? 'Next: call /api/news?q="<City, Country>" (Google News RSS).'
              : "Select a city to load news."}
          </p>
        </div>
      </div>
    </section>
  );
}
