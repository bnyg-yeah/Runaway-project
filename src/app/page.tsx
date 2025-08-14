// src/app/page.tsx
import HomeHub from "../components/HomeHub";
// import PingTest from "../components/PingTest";

export default function Page() {
  return (
    <div className="layout">
      <main className="mx-auto max-w-5xl p-6 space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-black">Runaway</h1>
          <p className="mt-1 text-sm text-gray-600">
            Escape to any city in the world!
          </p>
        </header>

        {/* interactive hub (search + feature cards) */}
        <HomeHub />
        {/* <PingTest /> */}
      </main>

      {/* footer for credits to api */}
      <footer className="pt-8 text-xs text-gray-500">
        Powered by Open‑Meteo (geocoding & weather), Unsplash (photos), and
        Google News RSS.
      </footer>
    </div>
  );
}
