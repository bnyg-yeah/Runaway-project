// src/lib/mongoose.ts
import mongoose from "mongoose";

let memoryServerPromise: Promise<
  import("mongodb-memory-server").MongoMemoryServer
> | null = null;

const uriFromEnv = process.env.MONGODB_URI?.trim();
const useExternal = Boolean(uriFromEnv);

declare global {
  // eslint-disable-next-line no-var
  var _mongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}
if (!global._mongoose) {
  global._mongoose = { conn: null, promise: null };
}

export async function connectToDB(): Promise<typeof mongoose> {
  if (global._mongoose?.conn) return global._mongoose.conn;

  if (!global._mongoose?.promise) {
    global._mongoose = global._mongoose ?? { conn: null, promise: null };

    global._mongoose.promise = (async () => {
      let uri = uriFromEnv;

      if (!useExternal) {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        if (!memoryServerPromise)
          memoryServerPromise = MongoMemoryServer.create();
        const mem = await memoryServerPromise;
        uri = mem.getUri();
      }

      await mongoose.connect(uri as string, {});
      return mongoose;
    })();
  }

  global._mongoose.conn = await global._mongoose.promise;
  return global._mongoose.conn;
}
