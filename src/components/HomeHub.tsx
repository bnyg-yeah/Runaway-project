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

//import cards here
import WeatherCard from "./WeatherCard";
import NewsCard from "./NewsCard";
import PhotosCard from "./PhotosCard";
import HistoryCard from "./HistoryCard";

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
    // A simple vertical stack is easier/safer than a grid for this layout.
    // We keep consistent gaps with space-y-6 and let each section own its own width.
    <section className="space-y-6">
      {/* 1) Search always on top */}
      <Search onSelect={handleSelect} />

      {/* 2) Weather: full-width, thin banner */}
      {/* We don't constrain width here — let it stretch across the screen */}
      <div>
        <WeatherCard place={selected} variant="banner" />
      </div>

      {/* 3) Photos: centered and large */}
      {/* Wrap in a wide max-width container and center with mx-auto. 
          Use responsive max-w-* so it feels big but doesn't overflow ultra-wide monitors. */}
      <div className="mx-auto w-full max-w-6xl px-0 sm:px-2">
        <PhotosCard place={selected} />
      </div>

      {/* 4) News: full-width below photos */}
      <div>
        <NewsCard place={selected} />
      </div>
      
      <div>
        <HistoryCard place={selected} />
      </div>
    </section>
  );
}
