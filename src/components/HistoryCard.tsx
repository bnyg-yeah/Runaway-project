// src/components/HistoryCard.tsx
"use client";

import { useEffect, useState } from "react";
import type { Place } from "./Search";

type HistoryItem = {
  id: string;
  city: string;
  region: string | null;
  country: string;
  viewedAt: string; // ISO string from API
};

type Props = { place: Place | null };

export default function HistoryCard({ place }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Save the current place to history whenever it changes
  useEffect(() => {
    if (!place) return;
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: place.city,
        region: place.region,
        country: place.country,
      }),
    }).catch(() => {
      // Ignore network error for POST — not critical for UI
    });
  }, [place]);

  // Always fetch the latest history
  useEffect(() => {
    fetch("/api/history", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { items: HistoryItem[] }) => {
        setItems(data.items);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Network error");
      });
  }, [place]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-black">History</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {items.length === 0 && !error && (
        <p className="mt-2 text-sm text-gray-500">No history yet.</p>
      )}
      <ul className="mt-3 space-y-1">
        {items.map((h) => (
          <li key={h.id} className="text-sm text-gray-700">
            {h.city}
            {h.region ? `, ${h.region}` : ""}, {h.country} ·{" "}
            {new Date(h.viewedAt).toLocaleString()}
          </li>
        ))}
      </ul>
    </section>
  );
}
