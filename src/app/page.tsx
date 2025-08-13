//src/app/page.tsx
"use client"; //Tells Next.js that the file must be treated as a client component and to run it in the browser instead of on the server. Needed for all browser interactivity

import { useQuery } from "@tanstack/react-query";

//Helper that fetches a URL and parses a JSON with a generic type T so TypeScript knows the shape of data youll get back
//async functions return a Promise which is a value that arrives later
async function fetchJSON<T>(url: string): Promise<T> {
  //calls the browsers fetch to request the resource at the url
  //await pauses until the Promise completes, then gives the result
  const res = await fetch(url, { cache: "no-store" }); //cache no store says dont serve a cached copy and it must ask the network

  //show error state with HTTP is not 200. React Query will then switch into error state and we show this message
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  //Parses the body as a JSON and asserts that it matches type T
  return res.json() as Promise<T>;
}

//A TypeScript type that says objects of type Ping have a boolean ok and a string time
//Useful in backend where if "time" is missing, TS will tell you where it is used
type Ping = { ok: boolean; time: string };

//Our first React component. Default page due to page.tsx
export default function HomePage() {
  //We get back from useQuery isLoading true when the first fetch is in progress, isError true if the last attempt errored, error is the actual Error object, data is the Ping data if loaded
  const { data, isLoading, isError, error } = useQuery({
    //its like a label for this request. later on will use "city", name
    queryKey: ["ping"],

    //queryFn is ran to fetch the data.
    //strong-type data with generic Ping so TS knows the JSON shape returned by /api/ping
    queryFn: () => fetchJSON<Ping>("/api/ping"),

    //For one minute after success, data is considered fresh and there is no auto refetch
    //Prevents user from seeing flickering when reloading page
    staleTime: 60_000, //60 seconds

    //Garbage collection time. After data is unused for 5 minutes, remove it from memory
    //Prevents unbounded memory growth and cleans up old cache entries
    gcTime: 300_000, //5 minutes

    //If request fails, React Query will retry three times.
    // Once is better for rate-limited APIs, but for start, we will do three which is default
    retry: 3, //so the total number of tries will be 1+3=4, if the request is failing

    //By default, ReactQuery refetches when the browser tab regains focus.
    //Best for APIs with quotas
    refetchOnWindowFocus: false,
  });

  //The actual UI
  return (
    //this is the page's main content
    //Tailwind classes centers horizontally, maximum width, padding
    <main className="mx-auto max-w-2xl p-6">
      {/* Title for app */}
      <h1 className="text-3x1 font-bold">Runaway</h1>
      {/* subtitle for app 
        mt-2 for margintop spacing*/}
      <p className="mt-2 text-sm text-neutral-400">App Prototype</p>

      {/* a section to show the ping result with a heading
      with a card-like styling with rounded corners, thing border, and padding */}
      <section className="mt-6 rounded-2x1 border border-neutral-800 p-4">
        <h2 className="text-x1 font-semibold">React Query to /api/ping</h2>

        {/* if isError is true then theres an error, show a red error message
          (error as Error) is Typescript to treat error like a standard Error to access .message */}
        {isError && (
          <p className="mt-2 text-red-400">
            Error : {(error as Error).message}
          </p>
        )}

        {/* if isLoading is true, then show the Loading */}
        {isLoading && <p className="mt-2 animate-pulse"> Loading</p>}

        {data && (
          // small card to show values
          <div className="mt-3 rounded-lg bg-neutral-900 p-3">
            <p className="text-sm text-white">
              ok:
              {/* String(data.ok) converts boolean to "true" or "false" for display */}
              <span className="font-mono">{String(data.ok)}</span>
            </p>

            {/* show the time in a readable way */}
            <p className="text-sm text-white">
              time: {/* title is for when hovering or inspecting */}
              <span className="font-mono" title={data.time}>
                {/* data.time is an ISO string from the server. We conver it to the user's locale to make it readable */}
                {new Date(data.time).toLocaleString()}
              </span>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
