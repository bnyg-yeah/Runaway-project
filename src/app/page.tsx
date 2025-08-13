// src/app/page.tsx
import HomeHub from "../components/HomeHub";
import PingTest from "../components/PingTest";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Runaway</h1>
        <p className="mt-1 text-sm text-gray-600">
          Type a city to explore (e.g., Paris, Blacksburg).
        </p>
      </header>

      {/* Client boundary: interactive hub (search + upcoming feature cards) */}
      <HomeHub />
      <PingTest />

      <footer className="pt-8 text-xs text-gray-500">
        Powered by Open‑Meteo (geocoding & weather), Unsplash (photos), and
        Google News RSS.
      </footer>
    </main>
  );
}
