# YC Jobs on Hacker News

A single-page app that lists Y Combinator job postings from the public
[HN Search API](https://hn.algolia.com/api) (Algolia). It supports free-text
search and a "posted within" filter, and loads more postings on demand.

There is no backend. The browser calls the search API directly through a typed
client generated from an OpenAPI spec and validates every response with Zod.
Search and the date filter run on the server.

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
| `HN_LIVE=1 npm run test:e2e` | Also runs a smoke test against the real search API  |
| `npm run openapi:generate`   | Regenerate `src/api/hn/generated/` from the spec    |

The first time you run Playwright, install the browser with
`npx playwright install chromium`.

## API client (OpenAPI + hey-api)

Algolia does not publish an OpenAPI spec for the HN index, so this repo keeps
its own: [`openapi/algolia-hn.yaml`](openapi/algolia-hn.yaml) (OpenAPI 3.1). It
was written from the [API docs](https://hn.algolia.com/api) and checked against
live responses. It describes only the one endpoint the app uses,
`GET /search_by_date`.

[`@hey-api/openapi-ts`](https://heyapi.dev) turns the spec into
`src/api/hn/generated/`:

| File           | Contents                                                    |
| -------------- | ----------------------------------------------------------- |
| `types.gen.ts` | TypeScript types (`JobHit`, `SearchResponse`, ...)          |
| `zod.gen.ts`   | Zod v4 schemas for every component and response             |
| `sdk.gen.ts`   | One function per operation (`searchByDate`)                 |
| `client/`      | A small bundled fetch runtime (no extra runtime dependency) |

Every SDK function validates the response body against its Zod schema.
`src/api/hn/client.ts` wraps those calls with retry and backoff, typed errors
(`HttpError`, `InvalidResponseError`), and the `searchJobs` function that builds the job query.

The generated files are committed. Don't edit them by hand. Change the spec and
run `npm run openapi:generate`.

**Why the generator lives in `tools/openapi-codegen/`:** the app uses
TypeScript 7, the native port, which has no JavaScript compiler API. hey-api
needs that API to print code. `tools/openapi-codegen` is a separate npm package
(with its own lockfile) that pins TypeScript 6 for the generator only. The
generated code is plain TypeScript and type-checks under the app's TS 7 strict
config. You can drop this package once hey-api supports TS 7.

## How it works

The search API returns full posts in one request, newest first, and indexes
about 17,000 job posts (not only the ~30 current YC ads):

- `GET /search_by_date?tags=job` returns one page of hits. Each hit carries the
  title, author, time, URL, and an HTML `job_text` body for inline postings.
- `query=` does full-text search and `numericFilters=created_at_i>N` filters by
  date, so both run on the server.
- Paging is capped at 1,000 hits. Past that the API reports `nbPages: 0`, and
  the app treats it as the end of the list.

The app loads postings with one TanStack infinite query
(`src/api/hn/jobsQuery.ts`):

1. It requests page 0 with 50 hits per page (`searchJobs`). There is no
   per-item fan-out, so it is one request per page.
2. The generated SDK checks the response against the spec's `SearchResponse`
   schema. `src/api/hn/schemas.ts` then validates each hit and normalizes it
   into a `Job`. That step parses the company and YC batch from the title,
   strips the HTML body to plain text, and drops non-http(s) URLs. A malformed
   hit is logged and skipped.
3. "Load more" fetches the next page and appends it.
4. The query key holds the search text and date range, so changing either
   starts a new query. Results are cached for 5 minutes.

Requests retry with exponential backoff on network errors, malformed JSON, 429,
and 5xx responses.

Search state (`q`, `within`) lives in the URL through TanStack Router, so
results can be shared and the Back button works. Defaults are left out of the
URL, and invalid values fall back to the defaults. The search box is debounced
by 300 ms, which also limits how often it calls the network.

### Content Security Policy

A small Vite plugin in `vite.config.ts` injects a CSP `<meta>` tag. The
production policy allows network access only to the app's own origin and
`https://hn.algolia.com`. The dev server's policy also permits
inline scripts and websockets, because React Refresh and HMR need them. The search
API sends `Access-Control-Allow-Origin: *`, so no proxy is needed.

## Project layout

```
src/
  api/hn/          Retrying client, job schema, query definition
  api/hn/generated/  hey-api output from openapi/algolia-hn.yaml (do not edit)
  components/      SearchBar, JobFilters, JobCard, JobList (one folder each)
  pages/JobsPage/  Page that composes the components
  routes/          TanStack Router file routes (route tree is generated)
  lib/             logger, formatting helpers
  test/            Vitest setup and shared fixtures
e2e/               Playwright specs and API fixtures
openapi/           Hand-maintained OpenAPI 3.1 spec for the HN Search API
tools/openapi-codegen/  Isolated hey-api + TypeScript 6 generator package
```

## Not included yet

- **History beyond 1,000 posts.** The search API caps paging at 1,000 hits per
  query. Narrow the search or the date range to reach older postings.
- **Sorting.** The API's `search_by_date` endpoint is newest-first only.
