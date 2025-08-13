//src/components/Search.tsx

/**
 * This file is for the search function
 */

"use client"; //running entirely in browser

//useState for input text, results array, and simple UI states
//useEffect to react to input changes and make network calls
//useRef to store mutable objects that persist across renders such as blur timer
import { useEffect, useRef, useState } from "react";

//same Place type as the normalized output from geocoding route.ts, we export to let other files import the same shape
export type Place = {
  city: string;
  region?: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

//onSelect is for when user picks a suggestion, pass a callback from the parent, where the parent decides what to do with fetching wheather or pushing city to URL
type Props = {
  onSelect: (place: Place) => void;
};

export default function Search({ onSelect }: Props) {
  //Local UI state for input box
  const [input, setInput] = useState("");

  //Suggestions and UI for the dropdown
  const [results, setResults] = useState<Place[]>([]); //list of Place matches to show
  const [isOpen, setIsOpen] = useState(false); //whether the dropdown is visible
  const [isLoading, setIsLoading] = useState(false); //whether we are currently fetching suggestions
  const [error, setError] = useState<string | null>(null); //readable error for network/upstream issues, not validation issues

  //stores the current abortController so when a new keystroke comes in we cancel the previous fetch, handles rapid typing, saves network and API calls
  const abortRef = useRef<AbortController | null>(null);

  //this is a stable value for the debounce relay so we dont fetch on every keystroke
  const DEBOUNCE_MS = 250;

  //Effect: whenever user input changes, wait a short moment then query /api/geocode
  //The purpose of the block below is that it makes a new debounce timer after the last keystroke before fetching, which results in fewer network calls and better typing feel
  //It will also abort previous requests so old responses dont conflict with new ones
  //Predictable UI with loading error success states
  //May upgrade to React Query in future
  useEffect(() => {
    // Guard: too short → reset & hide dropdown.
    if (input.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    //On user input, loading is true and error is null
    setIsLoading(true);
    setError(null);

    //Sets a new debounce timer
    const timer = setTimeout(async () => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(input)}&count=5`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (res.status === 400) {
          // Shouldn’t happen because we guard input length;
          setResults([]);
          setIsOpen(false);
          setIsLoading(false);
          setError("Type at least 2 letters.");
          return;
        }
        if (res.status === 404) {
          // Empty set (not an error)
          setResults([]);
          setIsOpen(true);
          setIsLoading(false);
          setError(null);
          return;
        }
        if (!res.ok) {
          // 502 from upstream, etc.
          setResults([]);
          setIsOpen(true);
          setIsLoading(false);
          setError(`Search failed (${res.status}).`);
          return;
        }

        const data = (await res.json()) as Place[];
        setResults(data);
        setIsOpen(true);
        setIsLoading(false);
        setError(null);
      } catch (err: unknown) {
        // Ignore abort; surface real network failure
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        ) {
          return;
        }
        setResults([]);
        setIsOpen(true);
        setIsLoading(false);
        setError("Network error. Please try again.");
      }
    }, DEBOUNCE_MS);

    // Cleanup when input changes quickly or component unmounts
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [input, DEBOUNCE_MS]);

  //turns Place into a readable label like Paris, Île-de-France, France
  const formatPlace = (p: Place) =>
    [p.city, p.region ?? undefined, p.country].filter(Boolean).join(", "); //boolean to remove undefined or null parts

  //When user picks a suggestion
  const handlePick = (p: Place) => {
    setInput(formatPlace(p)); // show final label in the input
    setIsOpen(false); // close dropdown
    onSelect(p); // inform parent about the chosen place
  };

  //Closes the dropdown on blur (when element loses focus such as clicking elsewhere on page) with a 100ms delay
  //Should make selection more reliable and easy
  const blurTimeoutRef = useRef<number | null>(null);
  const handleBlur = () => {
    // Delay closing so a click on a list item still registers
    blurTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 100);
  };
  const handleFocus = () => {
    if (results.length > 0) setIsOpen(true);
    if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
  };

  //Actual UI
  return (
    <div className="relative max-w-xl w-full">
      {/* The search input */}
      <label className="block text-sm font-medium mb-1">Search city</label>

      <input
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="city-suggestions"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Start typing… (e.g., Par, Blac)"
        className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Suggestions dropdown */}
      {isOpen && (
        <div
          id="city-suggestions"
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow"
        >
          {isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
          )}

          {!isLoading && error && (
            <div className="px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          {!isLoading && !error && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No places found
            </div>
          )}

          {!isLoading && !error && results.length > 0 && (
            <ul>
              {results.map((p, idx) => (
                <li
                  key={`${p.city}-${p.latitude}-${p.longitude}-${idx}`}
                  role="option"
                  tabIndex={-1}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()} // prevents input blur before click
                  onClick={() => handlePick(p)}
                >
                  <div className="font-medium">{formatPlace(p)}</div>
                  <div className="text-xs text-gray-500">
                    {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)} ·{" "}
                    {p.timezone}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
