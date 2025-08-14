Runaway
Runaway lets you virtually teleport to any city in the world without leaving home. In this MVP, pick a city and get live weather, fresh photos, and recent news headlines. It's a single page real time "window" into the city's vibe, designed for homesick users, curious explorers, and trip planners.


Installation:

Clone the repo with
    git clone https://github.com/bnyg-yeah/project.git

Install dependicies with 
    npm install

Create .env.local with API keys for advanced testing. Normal testing should be ok with no API key with Unsplash API. Edit .env.local and add your own Unsplash API key
    cp .env.example .env.local

Run locally with
    npm run dev


Features:

Autocomplete city search - type part of a name and pick from suggestions 
[Autocomplete](assets/Autocomplete.png)

Geocoding - allows passing the city's latitude and longitude to all features
[Geocoding](assets/Geocoding.png)

Current weather and today's forecast - adaptive data allows automatic display of Farenheit or Celsius depending on that region as well as option to view 24 hour forecast or 12 hour history and 12 hour forecast
[Weather](assets/Weather.png)

Fresh photos - 12 high quality recently taken images from Unsplash
[Photos](assets/Photos.png)

Recent news headlines - top articles from the past 7 days
[News](assets/News.png)

History of recent searched cities - using Mongoose you can see your past 10 searches
[History](assets/History.png)

Independent cards - each feature loads separately and does not break other cards in case of failure
[Indpendent](assets/Independent.png)

Adaptive design - works on mobile, tablet, and desktop
[Adaptive](assets/Adaptive.png)


Known Issue:

The search bar will show "No places found" after you select a city. Although its true, it is not great UI. I am also limited by the APIs since I am only using free APIs, for example since I am only using one source for the photos, photos may not be as recent as I would like.

Technology Stack:
Frontend: Next.js with React, TypeScript, and App Router
Styling: Tailwind CSS
State/Data fetching: React Query (TanStack)
Backend and API routes: Next.js server functions
Geocoding and Weather: Open Meteo (https://open-meteo.com/) 
Photos: Unsplash API (https://unsplash.com/developers)
News: Google News RSS (https://news.google.com/)
History: Mongoose


API Documentation:

GET /api/geocode

Convert a city name to coordinates and metadata (via Open-Meteo geocoding).

Query:
q (required), count (1–10, default 5), countryCode (optional ISO code)
Response: Place[]

type Place = {
  city: string;
  region?: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

POST /api/history

Add a city to the search history.

Body: { city: string, region?: string|null, country: string }
Response: ItemDTO

type ItemDTO = {
  id: string;
  city: string;
  region: string | null;
  country: string;
  viewedAt: Date;
};

GET /api/history

Return last 10 history items (newest first).

Response: { items: ItemDTO[] }

GET /api/news

Fetch recent headlines from Google News RSS.

Query:
q (required), hl (default "en-US"), gl (default "US"), n (1–20, default 12), og ("1" to fetch og:image)

Response: { items: NewsItem[] }

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAtISO: string;
  imageUrl: string;
};

GET /api/photos

Search Unsplash for city images.

Query:
q (required), n (1–24, default 12)

Response: { items: Photo[], mode: "key" | "anonymous" }

type Photo = {
  title: string;
  link: string;
  author: string;
  thumb: string;
  full: string;
  publishedAtISO: string;
};


Demo Video:
[Demo](assets/Demo.mp4)


Future Development:
In the future I hope to expand upon this app more with APIs and immersive design. I think of all the experiences people have when being in a place, which is why I plan to incorporate a sound element next. What better way is there than to play the city's local radio station? I also hope to offer a truly live experience in supported cities with a live webcam.


Contact:
You may contact me at bnyg@vt.edu.
