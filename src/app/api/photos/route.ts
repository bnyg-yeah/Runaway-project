// src/app/api/photos/route.ts

/**
 * /api/photos  — Unsplash search (dual-mode)
 * ------------------------------------------
 * - If UNSPLASH_ACCESS_KEY exists → send authorized request (recommended)
 * - Else → try anonymous request (useful for quick prototyping)
 *
 * Query:
 *   q: string   (required)  e.g. "Paris, France"
 *   n: number   (optional)  clamp 1..24 (default 12)
 *
 * Response (200):
 *   { items: Photo[], mode: "key" | "anonymous" }
 *
 * Errors:
 *   400  bad input
 *   500  anonymous rejected or missing key (with helpful message)
 *   502  network/upstream errors
 */

import { NextResponse } from "next/server";

// The shape our client uses — small and stable.
type Photo = {
  title: string;
  link: string;
  author: string;
  thumb: string;
  full: string;
  publishedAtISO: string;
};

// Minimal typing of Unsplash search response; we only read the fields we use.
type UnsplashResp = {
  results?: Array<{
    id: string;
    created_at?: string;
    urls?: { small?: string; regular?: string; full?: string };
    links?: { html?: string };
    user?: { name?: string };
    alt_description?: string | null;
    description?: string | null;
  }>;
};

export async function GET(req: Request) {
  // Parse and validate inputs
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  const nRaw = Number(searchParams.get("n") || 12);
  const n = Math.max(1, Math.min(24, Number.isFinite(nRaw) ? nRaw : 12)); // 1..24

  if (qRaw.length < 2) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Missing ?q=<City, Country> (min 2 chars).",
      },
      { status: 400 }
    );
  }

  // Build Unsplash URL (latest + safer content)
  const url =
    `https://api.unsplash.com/search/photos?` +
    `query=${encodeURIComponent(qRaw)}&per_page=${n}&order_by=latest&content_filter=high`;

  // Decide mode: with key (preferred) or anonymous (best-effort)
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  const headers = key ? { Authorization: `Client-ID ${key}` } : undefined;

  // Call Unsplash
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "network_error", message: "Failed to reach Unsplash." },
      { status: 502 }
    );
  }

  // If anonymous and rejected (401/403), explain clearly
  if (!res.ok) {
    if (!key && (res.status === 401 || res.status === 403)) {
      return NextResponse.json(
        {
          error: "anonymous_rejected",
          message:
            "Unsplash refused anonymous requests. Add UNSPLASH_ACCESS_KEY in .env.local.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "upstream_failed", message: `Unsplash failed: ${res.status}` },
      { status: 502 }
    );
  }

  // Normalize → Photo[]
  const data = (await res.json()) as UnsplashResp;
  const list = Array.isArray(data.results) ? data.results : [];

  const items: Photo[] = list.map((r) => {
    const title =
      (r.description?.trim() || r.alt_description?.trim() || "Untitled") +
      " (Unsplash)";
    const link = r.links?.html || `https://unsplash.com/photos/${r.id}`;
    const author = r.user?.name || "Unknown";
    const thumb = r.urls?.small || r.urls?.regular || r.urls?.full || "";
    const full = r.urls?.regular || r.urls?.full || r.urls?.small || "";
    const publishedAtISO = toISO(r.created_at || "");
    return { title, link, author, thumb, full, publishedAtISO };
  });

  // Include which mode we ran in (key vs anonymous) — handy for a tiny UI hint
  return NextResponse.json(
    { items, mode: key ? ("key" as const) : ("anonymous" as const) },
    { status: 200 }
  );
}

// Safe date helper
function toISO(d: string): string {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}
