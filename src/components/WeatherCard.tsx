// src/components/WeatherCard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "./Search";

// Map WMO weather codes to short labels
function codeToLabel(code: number | null | undefined): string {
  if (code == null) return "—";
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return `Code ${code}`;
}

const isAbortError = (e: unknown) =>
  e instanceof Error && e.name === "AbortError";

// API payload (already in chosen units from your API)
type WeatherResponse = {
  timezone: string;
  units: { temp: "C" | "F"; wind: "km/h" | "mph"; precip: "mm" };
  current: {
    timeISO: string;
    temp: number | null;
    feelsLike: number | null;
    isDay: boolean | null;
    precip: number | null;
    windSpeed: number | null;
    code: number | null;
  };
  hourly: Array<{
    timeISO: string;
    temp: number | null;
    code: number | null;
    precipProbPct: number | null;
  }>;
};

type Hour = WeatherResponse["hourly"][number];

type Props = {
  place: Place | null;
  variant?: "banner" | "card";
  /** Initial mode; user changes persist in localStorage. */
  defaultHourMode?: "next24" | "history";
};

// Fahrenheit locales (same heuristic as before)
const FAHRENHEIT_COUNTRIES = new Set([
  "United States",
  "USA",
  "US",
  "Puerto Rico",
  "Guam",
  "Northern Mariana Islands",
  "U.S. Virgin Islands",
  "American Samoa",
  "Bahamas",
  "Belize",
  "Cayman Islands",
  "Liberia",
  "Marshall Islands",
  "Micronesia",
  "Palau",
]);
const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
const isFahrenheitLocale = (place: Place | null) => {
  if (!place) return false;
  const c = norm(place.country);
  for (const name of FAHRENHEIT_COUNTRIES) if (norm(name) === c) return true;
  return false;
};

// localStorage key for user preference
const HOUR_MODE_KEY = "weatherHourMode";

export default function WeatherCard({
  place,
  variant = "card",
  defaultHourMode = "next24",
}: Props) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Read unit (for API param)
  const useFahrenheit = useMemo(() => isFahrenheitLocale(place), [place]);
  const unitParam = useFahrenheit ? "us" : "si";

  // Hour mode state with localStorage persistence
  const [hourMode, setHourMode] = useState<"next24" | "history">(
    defaultHourMode
  );
  useEffect(() => {
    // On mount, try to restore user preference
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(HOUR_MODE_KEY)
        : null;
    if (saved === "next24" || saved === "history") {
      setHourMode(saved);
    } else {
      setHourMode(defaultHourMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Persist whenever it changes
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HOUR_MODE_KEY, hourMode);
    }
  }, [hourMode]);

  // Fetch weather
  useEffect(() => {
    if (!place) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const url = `/api/weather?lat=${encodeURIComponent(place.latitude)}&lon=${encodeURIComponent(
      place.longitude
    )}&tz=${encodeURIComponent(place.timezone)}&days=7&unit=${unitParam}`;

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (res.status === 400) throw new Error("Invalid coordinates.");
        if (res.status === 404)
          throw new Error("No weather found for this place.");
        if (!res.ok) throw new Error(`Weather failed (${res.status}).`);
        return (await res.json()) as WeatherResponse;
      })
      .then((json) => {
        setData(json);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Network error.");
        setIsLoading(false);
        setData(null);
      });

    return () => controller.abort();
  }, [place, unitParam]);

  // Derive the 24-hour window based on hourMode
  const { windowHours, nowIndexInWindow } = useMemo(() => {
    const hours: Hour[] = (data?.hourly ?? []) as Hour[];
    if (!hours.length || !data?.current?.timeISO) {
      return { windowHours: hours.slice(0, 24), nowIndexInWindow: -1 };
    }

    // Find "now" index (exact match preferred)
    let idx = hours.findIndex((h) => h.timeISO === data.current.timeISO);
    if (idx < 0) {
      const now = Date.now();
      idx = hours.findIndex((h) => Date.parse(h.timeISO) >= now);
      if (idx < 0) idx = 0;
    }

    // Safe access (TS: non-null assertion is ok because hours.length > 0)
    const wrapGet = (i: number): Hour =>
      hours[(i + hours.length) % hours.length]!;

    if (hourMode === "next24") {
      const slice: Hour[] = [];
      for (let k = 0; k < 24; k++) slice.push(wrapGet(idx + k));
      return { windowHours: slice, nowIndexInWindow: 0 };
    } else {
      const back = 6;
      const forward = 18;
      const start = idx - back;
      const slice: Hour[] = [];
      for (let k = 0; k < back + forward; k++) slice.push(wrapGet(start + k));
      return { windowHours: slice, nowIndexInWindow: back };
    }
  }, [data, hourMode]);

  // Auto-center the "now" chip in history mode
  const listRef = useRef<HTMLDivElement | null>(null);
  const nowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (hourMode !== "history") return;
    if (!listRef.current || !nowRef.current) return;
    const list = listRef.current;
    const chip = nowRef.current;
    const chipCenter = chip.offsetLeft + chip.offsetWidth / 2;
    const targetScrollLeft = Math.max(0, chipCenter - list.clientWidth / 2);
    list.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
  }, [hourMode, windowHours.length, nowIndexInWindow]);

  // Styles
  const outer =
    variant === "banner"
      ? "rounded-2xl border border-gray-200 bg-white px-4 py-2 shadow-sm"
      : "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm";
  const title =
    variant === "banner"
      ? "text-base font-semibold text-black"
      : "text-lg font-semibold text-black";
  const meta =
    variant === "banner"
      ? "text-[11px] text-gray-600"
      : "text-xs text-gray-600";
  const row =
    variant === "banner"
      ? "flex flex-wrap items-center gap-2 text-sm text-gray-700"
      : "flex flex-wrap items-center gap-3 text-sm text-gray-700";
  const chipsWrap =
    variant === "banner"
      ? "mt-1 flex gap-2 overflow-x-auto"
      : "mt-2 flex gap-2 overflow-x-auto";
  const chipBase =
    "min-w-[60px] rounded-lg border p-2 text-center text-xs text-gray-700";
  const chipNormal = chipBase + " border-gray-100";
  const chipNow =
    chipBase +
    " border-blue-500 ring-2 ring-blue-300/60 font-semibold bg-blue-50";
  const bigTemp =
    variant === "banner"
      ? "text-xl font-bold text-black"
      : "text-2xl font-bold text-black";

  const fmtTemp = (n: number | null | undefined) =>
    typeof n === "number" ? `${Math.round(n)}°${data?.units.temp ?? ""}` : "—";
  const fmtWind = (n: number | null | undefined) =>
    typeof n === "number" ? `${Math.round(n)} ${data?.units.wind ?? ""}` : "—";

  // Segmented control button
  const SegButton = ({
    active,
    onClick,
    children,
    ariaLabel,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    ariaLabel: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={[
        "px-2.5 py-1 text-xs rounded-md transition",
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
      ].join(" ")}
    >
      {children}
    </button>
  );

  return (
    <section className={outer}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-end gap-2">
          <h2 className={title}>Weather</h2>
          {/* Unit label hint (optional, subtle) */}
          {data?.units?.temp && (
            <span className="text-[11px] text-gray-500">
              · {data.units.temp}, {data.units.wind}
            </span>
          )}
        </div>

        {/* Location + Hour-mode toggle group */}
        <div className="flex items-center gap-3">
          {/* Segmented control */}
          <div
            role="tablist"
            aria-label="Hourly view mode"
            className="flex items-center gap-1 rounded-lg bg-gray-100 p-1"
          >
            <SegButton
              active={hourMode === "next24"}
              onClick={() => setHourMode("next24")}
              ariaLabel="Show next 24 hours"
            >
              Next 24h
            </SegButton>
            <SegButton
              active={hourMode === "history"}
              onClick={() => setHourMode("history")}
              ariaLabel="Show recent past and upcoming hours"
            >
              History
            </SegButton>
          </div>

          {place && (
            <div className={meta}>
              {place.city}
              {place.region ? `, ${place.region}` : ""}, {place.country}
            </div>
          )}
        </div>
      </div>

      {/* States */}
      {!place && (
        <p className="mt-2 text-sm text-gray-500">
          Select a city to load weather.
        </p>
      )}
      {place && isLoading && (
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      )}
      {place && error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Data */}
      {place && data && (
        <div className={variant === "banner" ? "mt-1" : "mt-2"}>
          {/* Current snapshot */}
          <div className={row}>
            <span className={bigTemp}>{fmtTemp(data.current.temp)}</span>
            <span>{codeToLabel(data.current.code)}</span>
            {typeof data.current.feelsLike === "number" && (
              <span>· feels {fmtTemp(data.current.feelsLike)}</span>
            )}
            {typeof data.current.windSpeed === "number" && (
              <span>· wind {fmtWind(data.current.windSpeed)}</span>
            )}
          </div>

          {/* Hour strip */}
          <div ref={listRef} className={chipsWrap}>
            {windowHours.map((h, i) => {
              const t = new Date(h.timeISO);
              const hh = t.toLocaleTimeString(undefined, { hour: "numeric" });
              const isNow = i === nowIndexInWindow;
              return (
                <div
                  key={`${h.timeISO}-${i}`}
                  ref={isNow ? nowRef : null}
                  className={isNow ? chipNow : chipNormal}
                  aria-current={isNow ? "true" : undefined}
                >
                  <div className="text-gray-500">{hh}</div>
                  <div className="font-medium">{fmtTemp(h.temp)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
