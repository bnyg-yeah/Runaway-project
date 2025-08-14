// src/app/api/weather/route.ts
/**
 * Normalizes weather data for the client.
 * - NEW: Accepts ?unit=us|si (default "si")
 *   * us → fahrenheit + mph
 *   * si → celsius + km/h
 * - Responds with unit-neutral field names + a `units` descriptor
 */

import { NextResponse } from "next/server";

// Neutral response the client can render without converting
type WeatherResponse = {
  timezone: string;
  units: {
    temp: "C" | "F";
    wind: "km/h" | "mph";
    precip: "mm";
  };
  current: {
    timeISO: string;
    temp: number | null; // already in chosen unit
    feelsLike: number | null; // already in chosen unit
    isDay: boolean | null;
    precip: number | null; // mm (Open-Meteo returns mm)
    windSpeed: number | null; // already in chosen unit
    code: number | null;
  };
  today?: {
    date: string;
    high: number | null; // chosen unit
    low: number | null; // chosen unit
    precipProbMaxPct: number | null;
    code: number | null;
  };
  hourly: Array<{
    timeISO: string;
    temp: number | null; // chosen unit
    code: number | null;
    precipProbPct: number | null;
  }>;
  daily: Array<{
    date: string;
    high: number | null; // chosen unit
    low: number | null; // chosen unit
    precipProbMaxPct: number | null;
    code: number | null;
  }>;
};

// GET /api/weather?lat=...&lon=...&tz=...&days=...&unit=us|si
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Parse inputs
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const tz = (searchParams.get("tz") || "UTC").trim();
  const unitRaw = (searchParams.get("unit") || "si").toLowerCase(); // "us" or "si"
  const isUS = unitRaw === "us";

  const daysRaw = Number(searchParams.get("days") || 7);
  const days = Math.max(
    1,
    Math.min(16, Number.isFinite(daysRaw) ? daysRaw : 7)
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing or invalid lat/lon." },
      { status: 400 }
    );
  }

  // Build Open‑Meteo request
  const base = "https://api.open-meteo.com/v1/forecast";
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: tz,
    current:
      "temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: String(days),
    // NEW: units based on query
    temperature_unit: isUS ? "fahrenheit" : "celsius",
    wind_speed_unit: isUS ? "mph" : "kmh",
  });

  const upstreamURL = `${base}?${params.toString()}`;

  // Fetch upstream
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamURL, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "network_error", message: "Failed to reach weather provider." },
      { status: 502 }
    );
  }
  if (!upstreamRes.ok) {
    return NextResponse.json(
      {
        error: "upstream_failed",
        message: `Weather failed: ${upstreamRes.status}`,
      },
      { status: 502 }
    );
  }

  // Parse + safe access
  const data = await upstreamRes.json();
  const safe = <T>(v: unknown, fallback: T): T =>
    v === undefined || v === null ? fallback : (v as T);

  const curBlock = data.current;
  const legacyCur = data.current_weather;

  // Map to neutral names (already in chosen units)
  const current = {
    timeISO: safe<string>(curBlock?.time ?? legacyCur?.time, ""),
    temp: safe<number | null>(
      curBlock?.temperature_2m ?? legacyCur?.temperature ?? null,
      null
    ),
    feelsLike: safe<number | null>(
      curBlock?.apparent_temperature ?? null,
      null
    ),
    isDay: safe<boolean | null>(
      curBlock?.is_day ?? legacyCur?.is_day ?? null,
      null
    ),
    precip: safe<number | null>(curBlock?.precipitation ?? null, null), // mm
    windSpeed: safe<number | null>(
      curBlock?.wind_speed_10m ?? legacyCur?.windspeed ?? null,
      null
    ),
    code: safe<number | null>(
      curBlock?.weather_code ?? legacyCur?.weathercode ?? null,
      null
    ),
  };

  const hourlyTimes: string[] = safe<string[]>(data?.hourly?.time, []);
  const hourlyTemp: Array<number | null> = safe(
    data?.hourly?.temperature_2m,
    []
  );
  const hourlyCode: Array<number | null> = safe(data?.hourly?.weather_code, []);
  const hourlyPop: Array<number | null> = safe(
    data?.hourly?.precipitation_probability,
    []
  );

  const hourly = hourlyTimes.map((t, i) => ({
    timeISO: t,
    temp: hourlyTemp[i] ?? null, // chosen unit
    code: hourlyCode[i] ?? null,
    precipProbPct: hourlyPop[i] ?? null,
  }));

  const dailyDates: string[] = safe(data?.daily?.time, []);
  const dailyHigh: Array<number | null> = safe(
    data?.daily?.temperature_2m_max,
    []
  );
  const dailyLow: Array<number | null> = safe(
    data?.daily?.temperature_2m_min,
    []
  );
  const dailyPopMax: Array<number | null> = safe(
    data?.daily?.precipitation_probability_max,
    []
  );
  const dailyCode: Array<number | null> = safe(data?.daily?.weather_code, []);

  const daily = dailyDates.map((d, i) => ({
    date: d,
    high: dailyHigh[i] ?? null, // chosen unit
    low: dailyLow[i] ?? null, // chosen unit
    precipProbMaxPct: dailyPopMax[i] ?? null,
    code: dailyCode[i] ?? null,
  }));

  const today = daily[0]
    ? {
        date: daily[0].date,
        high: daily[0].high ?? null,
        low: daily[0].low ?? null,
        precipProbMaxPct: daily[0].precipProbMaxPct ?? null,
        code: daily[0].code ?? null,
      }
    : undefined;

  const payload: WeatherResponse = {
    timezone: safe<string>(data?.timezone, tz),
    units: {
      temp: isUS ? "F" : "C",
      wind: isUS ? "mph" : "km/h",
      precip: "mm",
    },
    current,
    today,
    hourly: hourly.slice(0, 24),
    daily,
  };

  return NextResponse.json(payload, { status: 200 });
}
