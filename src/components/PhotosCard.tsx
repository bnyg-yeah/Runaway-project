// src/components/PhotosCard.tsx

/**
 * PhotosCard — Immersive, wide & short hero gallery
 * -------------------------------------------------
 * - Calls /api/photos (Unsplash dual-mode)
 * - Stage is 16:9 (aspect-video) with object-cover → fills width, stays short
 * - No `any`: all error parsing uses `unknown` + type guards
 * - Safe indexing: we derive a `current` photo only when items & idx are valid
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "./Search";
import Image from "next/image";

// Shape returned by /api/photos
type Photo = {
  title: string;
  link: string;
  author: string;
  thumb: string;
  full: string;
  publishedAtISO: string;
};

type PhotosResponse = {
  items: Photo[];
  mode?: "key" | "anonymous";
};

type Props = { place: Place | null };

// Detect AbortError without any
const isAbortError = (e: unknown) =>
  e instanceof Error && e.name === "AbortError";

export default function PhotosCard({ place }: Props) {
  // Network / data state
  const [items, setItems] = useState<Photo[] | null>(null);
  const [mode, setMode] = useState<"key" | "anonymous" | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gallery index
  const [idx, setIdx] = useState(0);

  // Keep AbortController between renders
  const abortRef = useRef<AbortController | null>(null);

  // Fetch on city change
  useEffect(() => {
    if (!place) {
      setItems(null);
      setMode(undefined);
      setIdx(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIdx(0);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const q = `${place.city}, ${place.country}`;
    const url = `/api/photos?q=${encodeURIComponent(q)}&n=12`;

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (res.status === 400) throw new Error("Missing or invalid city.");
        if (res.status === 500) {
          // Parse body as unknown; pick message only if it's a string (no `any`)
          const errBody: unknown = await res.json().catch(() => null);
          const msg =
            typeof errBody === "object" &&
            errBody !== null &&
            "message" in errBody &&
            typeof (errBody as { message: unknown }).message === "string"
              ? (errBody as { message: string }).message
              : "Photos unavailable (add UNSPLASH_ACCESS_KEY).";
          throw new Error(msg);
        }
        if (!res.ok) throw new Error(`Photos failed (${res.status}).`);
        return (await res.json()) as PhotosResponse;
      })
      .then((json) => {
        setItems(json.items);
        setMode(json.mode);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Network error.");
        setIsLoading(false);
        setItems(null);
        setMode(undefined);
      });

    return () => controller.abort();
  }, [place]);

  // Move index (wrap-around)
  const move = useCallback(
    (delta: number) => {
      if (!items || items.length === 0) return;
      setIdx((i) => (i + delta + items.length) % items.length);
    },
    [items]
  );

  // Keyboard ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // Compute a safe current photo; if invalid, becomes null (never undefined)
  const current: Photo | null = useMemo(() => {
    if (!items || items.length === 0) return null;
    const clamped = Math.min(Math.max(idx, 0), items.length - 1);
    return items[clamped] ?? null;
  }, [items, idx]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header with tiny mode note */}
      <header className="flex items-center justify-between px-4 py-2">
        <h2 className="text-lg font-semibold text-black">Photos</h2>
        <div className="flex items-center gap-3">
          {mode === "anonymous" && (
            <span className="hidden sm:inline text-[11px] text-gray-500">
              No key — results may be limited
            </span>
          )}
          {place && (
            <div className="text-xs text-gray-600">
              {place.city}
              {place.region ? `, ${place.region}` : ""}, {place.country}
            </div>
          )}
        </div>
      </header>

      {/* States */}
      {!place && (
        <div className="px-4 pb-4 text-sm text-gray-500">
          Select a city to load photos.
        </div>
      )}
      {place && isLoading && (
        <div className="px-4 pb-4 text-sm text-gray-500">Loading photos…</div>
      )}
      {place && error && (
        <div className="px-4 pb-4 text-sm text-red-600">{error}</div>
      )}
      {place && items && items.length === 0 && (
        <div className="px-4 pb-4 text-sm text-gray-500">No photos found.</div>
      )}

      {/* Wide & short hero: 16:9 frame with object-cover (fills width; crops minimally) */}
      {place && current && (
        <div className="relative">
          {/* Stage */}
          <div className="relative w-full aspect-video md:aspect-[1.5/1] bg-black/5">
            <Image
              src={current.full || current.thumb}
              alt={current.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw,
               (max-width: 1200px) 80vw,
               1200px"
            />
          </div>

          {/* Left/Right buttons */}
          <button
            aria-label="Previous photo"
            onClick={() => move(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-black shadow hover:bg-white"
          >
            ←
          </button>
          <button
            aria-label="Next photo"
            onClick={() => move(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-black shadow hover:bg-white"
          >
            →
          </button>

          {/* Caption */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-gray-700">
            <div className="truncate">
              <span className="font-medium">{current.author}</span>{" "}
              <span className="text-gray-500">· {current.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Optional visible counter next to the "View on Unsplash" link */}
              {items && items.length > 0 && (
                <span className="text-gray-500">
                  {idx + 1}/{items.length}
                </span>
              )}

              <a
                href={current.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-blue-600 hover:underline"
              >
                View on Unsplash
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
