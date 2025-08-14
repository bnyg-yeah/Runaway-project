"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "./Search";

// Match the server’s shape (no imageUrl now)
type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAtISO: string;
};

type Props = { place: Place | null };

const isAbortError = (e: unknown) =>
  e instanceof Error && e.name === "AbortError";

function fmtWhen(iso: string, timeZone: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(d);
  } catch {
    return "";
  }
}

export default function NewsCard({ place }: Props) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!place) {
      setItems(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const q = `${place.city}, ${place.country}`;
    const url = `/api/news?q=${encodeURIComponent(q)}&n=12`;

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (res.status === 400) throw new Error("Missing or invalid query.");
        if (!res.ok) throw new Error(`News failed (${res.status}).`);
        const data = (await res.json()) as { items: NewsItem[] };
        return Array.isArray(data.items) ? data.items : [];
      })
      .then((raw) => {
        const sorted = [...raw].sort(
          (a, b) =>
            Date.parse(b.publishedAtISO || "") -
            Date.parse(a.publishedAtISO || "")
        );
        setItems(sorted.slice(0, 6)); // keep 6
        setIsLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Network error.");
        setIsLoading(false);
        setItems(null);
      });

    return () => controller.abort();
  }, [place]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-black">News</h2>

      {!place && (
        <p className="mt-2 text-sm text-gray-500">
          Select a city to load news.
        </p>
      )}
      {place && isLoading && (
        <p className="mt-2 text-sm text-gray-500">Loading headlines…</p>
      )}
      {place && error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {place && items && (
        <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((it, idx) => (
            <li
              key={`${it.link}-${idx}`}
              className="overflow-hidden rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition"
            >
              {/* Headline */}
              <a
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-medium text-blue-600 hover:underline"
              >
                {it.title}
              </a>

              {/* Meta info */}
              <div className="mt-1 text-xs text-gray-600">
                <span className="font-semibold">{it.source}</span>
                {it.publishedAtISO && place?.timezone && (
                  <> · {fmtWhen(it.publishedAtISO, place.timezone)}</>
                )}
              </div>
            </li>
          ))}

          {items.length === 0 && (
            <li className="text-sm text-gray-500">
              No recent headlines found.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
