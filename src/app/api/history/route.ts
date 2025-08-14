// src/app/api/history/route.ts
// POST /api/history : create one
// GET  /api/history : last 10 (newest first)
// Must run on Node (mongodb-memory-server binary)
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongoose";
import { HistoryModel, HistoryDoc, HistoryLean } from "@/models/History";

export const runtime = "nodejs";

type PostBody = {
  city?: string;
  region?: string | null;
  country?: string;
};

type ItemDTO = {
  id: string;
  city: string;
  region: string | null;
  country: string;
  viewedAt: Date;
};

export async function POST(req: Request) {
  try {
    await connectToDB();

    const body: PostBody = await req.json();

    if (!body.city || !body.country) {
      return NextResponse.json(
        { message: "city and country are required" },
        { status: 400 }
      );
    }

    // Create with strong typing; no `any`
  const doc = await HistoryModel.create({
    city: body.city.trim(),
    region: body.region?.trim() || null,
    country: body.country.trim(),
    viewedAt: new Date(), // ✅ matches HistoryDoc, aligns with schema default
  } satisfies HistoryDoc);

    const payload: ItemDTO = {
      id: doc._id.toString(),
      city: doc.city,
      region: doc.region ?? null,
      country: doc.country,
      viewedAt: doc.viewedAt,
    };

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    console.error("POST /api/history error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDB();

    // Tell TS exactly what lean() returns:
    const items = await HistoryModel.find({})
      .sort({ viewedAt: -1 })
      .limit(10)
      .lean<HistoryLean[]>()
      .exec();

    // Now items is HistoryLean[], so .map has proper types and no implicit any.
    const out: ItemDTO[] = items.map((it) => ({
      id: it._id.toString(),
      city: it.city,
      region: it.region ?? null,
      country: it.country,
      viewedAt: it.viewedAt,
    }));

    return NextResponse.json({ items: out }, { status: 200 });
  } catch (err) {
    console.error("GET /api/history error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
