// src/models/History.ts
// Minimal schema for city history (avoid DOM name collisions by exporting HistoryModel)

import { Schema, model, models, Types, Model } from "mongoose";

export interface HistoryDoc {
  city: string;
  region?: string | null;
  country: string;
  viewedAt: Date;
}

// Shape returned by lean() (adds _id as ObjectId)
export type HistoryLean = HistoryDoc & { _id: Types.ObjectId };

// Explicit model type so TS knows create/find are callable
export type HistoryModelType = Model<HistoryDoc>;

const HistorySchema = new Schema<HistoryDoc>(
  {
    city: { type: String, required: true, trim: true },
    region: { type: String, default: null, trim: true },
    country: { type: String, required: true, trim: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// IMPORTANT: avoid exporting name "History" (conflicts with DOM History)
export const HistoryModel: HistoryModelType =
  (models.History as HistoryModelType) ||
  model<HistoryDoc>("History", HistorySchema);
