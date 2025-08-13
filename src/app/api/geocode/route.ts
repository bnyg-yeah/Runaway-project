// src/app/api/geocode/route.ts

/**
 * This file will convert a typed city name into coordinates that our features will use
 *
 * Currently using Open-Meteo's free geocoding
 * Returns a normalized array of Place objects
 */

import { NextResponse } from "next/server";

type Place = {
  city: string;
  region?: string | null; //Ile de France, Virignia...
  country: string;
  latitude: number;
  longitude: number;
  timezone: string; //Europe
};

type OpenMeteoResult = {
  name: string;
  admin1?: string | null;
  admin2?: string | null;
  country: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone?: string | null;
};
type OpenMeteoResponse = { results?: OpenMeteoResult[] };

//this runs when someone calls endpoint with a HTTP GET request
// req: request is the standard Web Fetch API Request object that is passed in by Next.js
export async function GET(req: Request) {
  //First step is to read query parameters
  //req.url looks like http://localhost:3000/api/geocode?q=Paris&count=5
  //we destructure searchParams to grab the parameters property from the URL
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim(); //reads ?q= and onwards. now q holds the typed city's name
  const countFound = searchParams.get("count") ?? "5"; //reads ?count= parameter which is how many suggestions we should return. we default to 5
  const count = Math.max(1, Math.min(10, Number(countFound) || 5)); //we must return at least 1 suggestion and max 10 suggestion to prevent abuse suggest ?count=99999, anything that falls outside of 1-10 will become 5
  const countryCode = searchParams.get("countryCode")?.toUpperCase() || "";

  //Now we validate our input
  if (!q || q.length < 2) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Missing ?q=<place> or must be at least 2 characters.",
      }, //if q (city name) is missing then show error code and message
      { status: 400 }
    );
  }

  //Build Open-Meteo geocoding URL
  const baseURL = "https://geocoding-api.open-meteo.com/v1/search";
  const paramsURL = new URLSearchParams({
    name: q,
    count: String(count),
    language: "en",
    format: "json",
  });

  if (countryCode) paramsURL.set("countryCode", countryCode); //if user gives a country code, then we pass that to OpenMeteo

  //put together our URL
  const apiURL = `${baseURL}?${paramsURL.toString()}`;

  //Call the upstream API
  //If this fails to call the upstream API, it is not our coding fault, its likely going to be OpenMeteo
  const upstreamResult = await fetch(apiURL, { cache: "no-store" }); //we wait for server fetch to OpenMeteo, we disable cachine so every request gets fresh data and we see live changes during development
  if (!upstreamResult.ok) {
    return NextResponse.json(
      {
        error: "upstream_failed",
        message: `Geocoding failed: ${upstreamResult.status}`,
      },
      { status: 502 } //502 is bad gateway, which is when our server is fine but an upstream dependency failed
    );
  }

  //Normalize the data
  const data = await upstreamResult.json();
  const rawData: OpenMeteoResult[] = Array.isArray(data.results)
    ? data.results
    : []; //check if data.results is an array, if not set [] to avoid errors

    //transform each raw result into our Place shape to be used by our UI
  const places: Place[] = rawData.map((r) => ({
    city: r.name,
    region: r.admin1 ?? r.admin2 ?? null, //region picks admin1 if available which is state/province, then admin2, else null
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? "UTC", //timezone defaults to UTC if missing
  }));

  //Handle no results
  if (places.length === 0) {
    return NextResponse.json(
      { error: "not_found", message: `No places for "${q}"` },
      { status: 404 }
    );
  }

  //Return success, sends the normalized array as JSON, default status of 200 OK
  return NextResponse.json(places);
}
