# YC Jobs on Hacker News

A single-page app that lists Y Combinator job postings from the public
[Hacker News API](https://github.com/HackerNews/API). It supports free-text
search, a "posted within" filter, and newest/oldest sorting.

There is no backend. The browser calls the HN API directly, validates every
response with Zod, and searches and filters the cached list on the client.

## Quick start

```sh
npm install
npm run dev          # http://localhost:5173
```

## Scripts

| Command                      | What it does                                        |
| ---------------------------- | --------------------------------------------------- |
| `npm run dev`                | Vite dev server with HMR                            |
| `npm run build`              | Type-check (`tsc -b`) and build to `dist/`          |
| `npm run preview`            | Serve the production build                          |
| `npm run lint`               | oxlint                                              |
| `npm run lint:types`         | TypeScript strict type check                        |
| `npm run format`             | Prettier (4-space indent)                           |
| `npm test`                   | Vitest unit and component tests                     |
| `npm run test:e2e`           | Playwright against the production build, API mocked |
| `HN_LIVE=1 npm run test:e2e` | Also runs a smoke test against the real HN API      |

The first time you run Playwright, install the browser with
`npx playwright install chromium`.

## How it works

The HN API has no bulk, search, or paging endpoints:

- `GET /v0/jobstories.json` returns up to 200 job IDs, newest first.
- `GET /v0/item/{id}.json` returns one posting. It returns `null` with HTTP 200
  for unknown IDs. Older postings carry an HTML `text` body and an empty `url`.

The app loads the list in one TanStack Query (`src/api/hn/jobsQuery.ts`):

1. It fetches the ID list.
2. It fetches each item with at most 10 requests in flight.
3. It validates each item with Zod (`src/api/hn/schemas.ts`) and normalizes
   it into a `Job`. That step parses the company and YC batch from the title,
   strips the HTML body to plain text, and drops non-http(s) URLs.
4. It caches the result for 5 minutes. Search and filters run in memory and
   never touch the network.

Requests retry with exponential backoff on network errors, malformed JSON, 429,
and 5xx responses. A missing, deleted, or malformed item is logged and skipped
instead of failing the whole list.

Search state (`q`, `sort`, `within`) lives in the URL through TanStack Router,
so results can be shared and the Back button works. Defaults are left out of
the URL, and invalid values fall back to the defaults.

### Content Security Policy

A small Vite plugin in `vite.config.ts` injects a CSP `<meta>` tag. The
production policy allows network access only to the app's own origin and
`https://hacker-news.firebaseio.com`. The dev server's policy also permits
inline scripts and websockets, because React Refresh and HMR need them. The HN
API sends `Access-Control-Allow-Origin: *`, so no proxy is needed.

## Project layout

```
src/
  api/hn/          HN client, Zod schemas, query definition, filtering
  components/      SearchBar, JobFilters, JobCard, JobList (one folder each)
  pages/JobsPage/  Page that composes the components
  routes/          TanStack Router file routes (route tree is generated)
  lib/             logger, formatting, concurrency helpers
  test/            Vitest setup and shared fixtures
e2e/               Playwright specs and API fixtures
```

## Not included yet

- **Paging.** The feed is about 30 to 200 items and the HN API cannot page, so
  the whole list is loaded at once.
- **Generated API client.** HN publishes no OpenAPI spec, so hey-api cannot be
  used. The Zod schemas provide the typed, validated service layer instead.
