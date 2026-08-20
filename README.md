# Blistrip — AI Travel Planner

A polished MVP for an AI-powered travel planning platform. Tell Blistrip your budget, dates, travel style, and interests — get a personalized trip plan in seconds.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | Enables live AI trip generation via OpenAI. Without it, the app uses high-quality mock responses. |

The app works fully without an API key — no errors are shown to users.

## What's included

- **Landing page** — Hero, how it works, why Blistrip, example trip, CTA
- **AI Trip Planner** — 8-step guided wizard with progress indicator
- **Trip Results** — Neighborhoods, hotels, day-by-day itinerary, budget, activities, restaurants, travel essentials
- **Destination Explorer** — 10 European destinations with pre-filled planner links
- **Saved Trips** — Save/view/delete trips via localStorage
- **Profile** — Travel preferences stored locally
- **About** — How it works page

## What's mocked

- Trip plans when `OPENAI_API_KEY` is missing or API fails
- Hotel/activity/restaurant booking URLs (placeholder affiliate structure in `/lib/affiliate.ts`)
- Travel essentials product links
- User authentication (localStorage only)
- Live pricing and availability

## Project structure

```
/app          — Pages and API routes
/components   — UI, layout, planner, trip results, landing
/lib          — AI, mock data, analytics, affiliate links, storage
/types        — TypeScript types
```

## Next steps

- Wire real affiliate partners (Booking.com, GetYourGuide, etc.)
- Add user accounts and cloud trip storage
- Integrate live hotel/activity APIs
- Add analytics provider (PostHog, Mixpanel, etc.) via `/lib/analytics.ts`
- Expand destination database and images
