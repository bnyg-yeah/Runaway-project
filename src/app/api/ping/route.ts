//src/app/api/ping/route.ts

/**
 * First backend of the app
 * App relies on API routs to call multiple external APIs
 * This file is to test that runs React Query to ping to API response, proving that end to end communication works
 * We can test loading states, error states, and data rendering
 */
export async function GET() {
  //exporting this GET function tells Next.js that when a HTTP GET request hits the ping folder, run this function. Uses Web Fetch API
  return new Response( //returns a small JSON payload to test client fetching
    JSON.stringify({
      //this is a small text body containing JSON
      ok: true, //flag to check from the client to confirm it worked
      time: new Date().toISOString(), //returns the current time in UTC to prove server-side execution is happening
    }),
    {
      headers: { "Content-Type": "application/json" }, //ensures the client (the app) knows this is JSON
      status: 200, //200 is success
    }
  );
}
