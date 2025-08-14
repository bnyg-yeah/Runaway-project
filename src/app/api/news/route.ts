// src/app/api/news/route.ts

/**
 * /api/news
 * ----------
 * Server-side wrapper around Google News RSS (no API key required).
 *
 * Query params:
 *   q   : string (required) - search text, e.g., "Paris, France"
 *   hl  : string (optional) - language+region (Google-style), default "en-US"
 *   gl  : string (optional) - region/country, default "US"
 *   n   : number (optional) - number of results to return (1..20, default 12)
 *   og  : "1"    (optional) - if present/true, fetch article pages for <meta property="og:image">
 *
 * Response: { items: NewsItem[] }
 *   where NewsItem = { title, link, source, publishedAtISO, imageUrl }
 *
 * Notes:
 * - We add `when:7d` to the query to bias results to the last 7 days.
 * - We unwrap Google News redirect links to the real publisher URL (`url=` query param) when present.
 * - We parse RSS with small helpers (regex/slicing) to avoid extra deps.
 * - For better image coverage, you can enable the optional og:image fallback via &og=1.
 */

import { NextResponse } from "next/server";

// Tell Next.js not to cache this route at the framework level.
// This keeps results feeling "live" while you iterate.
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type NewsItem = {
  title: string;           // Human-readable headline (cleaned/decoded)
  link: string;            // Direct publisher URL (if we can unwrap it)
  source: string;          // <source> text or derived from hostname
  publishedAtISO: string;  // ISO timestamp (empty string if unknown)
  imageUrl: string;        // Best-effort thumbnail URL (may be "")
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants for optional og:image fetching (kept conservative).
// ─────────────────────────────────────────────────────────────────────────────

const OG_TIMEOUT_MS = 2500;     // Stop trying quickly; we don't want to stall the page.
const OG_MAX_CONCURRENCY = 3;   // Be polite and avoid flooding remote sites.

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // 1) Parse + validate query params
  const { searchParams } = new URL(req.url);

  // q: "City, Country" like "Paris, France"
  const qRaw = (searchParams.get("q") || "").trim();

  // hl: Google-style language+region (e.g., "en-US")
  const hl = (searchParams.get("hl") || "en-US").trim();

  // gl: region/country code (e.g., "US")
  const gl = (searchParams.get("gl") || "US").trim();

  // n: number of results to return (clamped 1..20, default 12)
  const nRaw = Number(searchParams.get("n") || 12);
  const n = Math.max(1, Math.min(20, Number.isFinite(nRaw) ? nRaw : 12));

  // og: "1" enables extra fetch to try <meta property="og:image">
  const og = (searchParams.get("og") || "").trim() === "1";

  if (qRaw.length < 2) {
    // 400 = client error: missing/invalid query
    return NextResponse.json(
      { error: "bad_request", message: "Missing ?q=<search>, at least 2 chars." },
      { status: 400 }
    );
  }

  // Encourage recency. Google News supports "when:7d" in the search term.
  // Example final search: "Paris, France when:7d"
  const q = `${qRaw} when:7d`;

  // 2) Build Google News RSS URL
  // Format: https://news.google.com/rss/search?q=<query>&hl=<lang-REGION>&gl=<REGION>&ceid=<REGION>:<lang>
  const base = "https://news.google.com/rss/search";
  const langOnly = hl.split("-")[0] || "en";          // "en" from "en-US"
  const ceid = `${gl}:${langOnly}`;                   // e.g., "US:en"
  const url = `${base}?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

  // 3) Fetch the RSS XML (we use cache: "no-store" to avoid browser-level caching between requests)
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    // 502 = upstream/gateway-ish error (we failed to reach Google News RSS)
    return NextResponse.json(
      { error: "network_error", message: "Failed to reach Google News." },
      { status: 502 }
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: "upstream_failed", message: `RSS fetch failed: ${res.status}` },
      { status: 502 }
    );
  }
  const xml = await res.text();

  // 4) Parse items, map to our shape, and optionally hydrate images with og:image
  const baseItems = extractItems(xml)
    .slice(0, n)               // Take at most n items from the feed
    .map((itemXML) => normalizeItem(itemXML)); // Convert each <item> block → NewsItem

  // Optional: fetch each article page (limited, timed) to try <meta property="og:image">
  const items = og ? await hydrateWithOgImages(baseItems) : baseItems;

  // 5) Respond with compact JSON for the client
  return NextResponse.json({ items }, { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal XML helpers (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

/** Find every <item>...</item> block. */
function extractItems(xml: string): string[] {
  // [\s\S]*? is a classic trick to match across newlines non-greedily.
  const re = /<item[\s\S]*?<\/item>/g;
  return xml.match(re) ?? [];
}

/** Pull out wanted child tags and coerce to our NewsItem shape. */
function normalizeItem(itemXML: string): NewsItem {
  // Title may be inside CDATA and sometimes contains HTML.
  let title = decode(clean(tag(itemXML, "title")));

  // Fallback: some feeds put the meaningful text in <description> instead.
  if (!title) {
    const desc = decode(stripTagsPreserveImg(tag(itemXML, "description")));
    title = desc.slice(0, 160); // show a short snippet rather than blank
  }

  // Link may be a Google redirect; unwrap if `?url=` exists.
  const linkRaw = clean(tag(itemXML, "link"));
  const link = unwrapGoogleNewsLink(linkRaw);

  // Published date → ISO string (or empty).
  const pubDate = clean(tag(itemXML, "pubDate"));
  const publishedAtISO = toISO(pubDate);

  // Source can come from <source>; otherwise we derive it from the hostname.
  const source = decode(clean(tag(itemXML, "source"))) || hostname(link) || "Unknown";

  // Try several places for a usable image:
  // 1) <media:content url="...">
  // 2) <enclosure url="...">
  // 3) <img src="..."> inside description/content
  let imageUrl =
    attr(itemXML, "media:content", "url") ||
    attr(itemXML, "enclosure", "url") ||
    firstImageFromHTML(tag(itemXML, "description")) ||
    firstImageFromHTML(tag(itemXML, "content:encoded")) ||
    "";

  // Normalize protocol-less URLs (rare)
  if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;

  return { title, link, source, publishedAtISO, imageUrl };
}

/** Extract inner text for a given tag name, first occurrence only. */
function tag(xml: string, name: string): string {
  // Handles optional attributes (e.g., <source ...>) and multiline content.
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = re.exec(xml);
  return m?.[1] ?? "";
}

/** Strip CDATA + tags + trim. */
function clean(s: string): string {
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"); // unwrap CDATA
  out = out.replace(/<[^>]+>/g, "");                        // remove HTML tags
  return out.trim();
}

/** Like clean(), but keep <img> tags so we can try to extract srcs later. */
function stripTagsPreserveImg(s: string): string {
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Remove everything except <img ...>
  out = out.replace(/<(?!img\b)[^>]+>/g, "");
  return out.trim();
}

/** Minimal HTML entity decode. Extend if you see more entities in the wild. */
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** If link is a Google News redirect, unwrap the real `url=` param. */
function unwrapGoogleNewsLink(link: string): string {
  try {
    const u = new URL(link);
    const real = u.searchParams.get("url");
    return real ? real : link;
  } catch {
    return link;
  }
}

/** Convert various date strings to ISO; empty string if invalid. */
function toISO(d: string): string {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

/** Derive a readable source from a URL if <source> tag is missing. */
function hostname(link: string): string | null {
  try {
    const { hostname } = new URL(link);
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Get attribute value from the first occurrence of a tag, e.g. url from:
 *   <media:content url="https://..." />
 *
 * IMPORTANT: We guarantee a string for `attrs` so TS never sees undefined.
 * Also supports both double "..." and single '...' quotes.
 */
function attr(xml: string, tagName: string, attrName: string): string {
  // Find the opening tag and capture its raw attributes (group 1).
  const m = new RegExp(`<${tagName}\\b([^>]*)>`, "i").exec(xml);

  // ✅ Force a string for TS; empty string if tag not found.
  const attrs: string = m?.[1] ?? "";
  if (!attrs) return "";

  // Support "double" or 'single' quotes around attribute values.
  const reAttr = new RegExp(`${attrName}\\s*=\\s*"(.*?)"|'(.*?)'`, "i");
  const ma = reAttr.exec(attrs);

  // If group 1 (") didn’t match, group 2 (') might have.
  return (ma?.[1] ?? ma?.[2] ?? "").trim();
}

/** Find the first <img src="..."> inside an HTML fragment, return its src. */
function firstImageFromHTML(html: string): string {
  const re = /<img[^>]+src=["']([^"']+)["']/i;
  const m = re.exec(html || "");
  return (m?.[1] ?? "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional og:image hydration (conservative: timeout + concurrency cap)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Try to fetch an article page and extract <meta property="og:image" content="...">
 * Returns "" on any failure (fast‑fail).
 */
async function tryFetchOgImage(url: string, signal: AbortSignal): Promise<string> {
  try {
    const res = await fetch(url, { signal, redirect: "follow" });
    if (!res.ok) return "";
    const html = await res.text();

    // Minimal OG parser via regex; handles attribute order variations.
    const m =
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);

    let og = m?.[1] ?? "";
    if (og.startsWith("//")) og = "https:" + og; // protocol-less → https
    return og;
  } catch {
    return "";
  }
}

/**
 * Given a list of items, fetch a few article pages in parallel to pull og:image
 * only for those that lack imageUrl already.
 */
async function hydrateWithOgImages(items: NewsItem[]): Promise<NewsItem[]> {
  const out: NewsItem[] = [];
  let i = 0;

  while (i < items.length) {
    // Run up to N in parallel
    const batch = items.slice(i, i + OG_MAX_CONCURRENCY);

    // Abort the entire batch if it takes too long
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);

    const results = await Promise.all(
      batch.map(async (it) => {
        if (it.imageUrl) return it; // already has an image
        const og = await tryFetchOgImage(it.link, controller.signal);
        return { ...it, imageUrl: og || "" };
      })
    );

    clearTimeout(timer);
    out.push(...results);
    i += OG_MAX_CONCURRENCY;
  }

  return out;
}
