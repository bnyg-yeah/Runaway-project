Runaway
Runaway lets you virtually teleport to any city in the world without leaving home. In this MVP, pick a city and get live weather, fresh photos, and recent news headlines. It's a single page real time "window" into the city's vibe, designed for homesick users, curious explorers, and trip planners.

Installation:
Clone the repo with
git clone https://github.com/bnyg-yeah/project.git
Install dependicies with 
npm install
Create .env.local with API keys
cp .env.example .env.local
Edit .env.local and add your own Unsplash API key
Run locally with
npm run dev

Features
Autocomplete city search - type part of a name and pick from suggestions
Current weather and today's forecast 
Fresh photos - high quality images from Unsplash
Recent news headlines - top articles from the past 7 days
Independent cards - each feature loads separately and does not break other cards in case of failure
Adaptive design - works on mobile, tablet, and desktop

Technology Stack
Frontend: Next.js with React, TypeScript, and App Router
Styling: Tailwind CSS
State/Data fetching: React Query (TanStack)
Backend and API routes: Next.js server functions
Geocoding and Weather: Open Meteo (https://open-meteo.com/)
Photos: Unsplash API (https://unsplash.com/developers)
News: Google News RSS (https://news.google.com/)
