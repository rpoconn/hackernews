# YC Jobs on Hacker News

A single-page app that lists Y Combinator job postings from the public
[Hacker News API](https://github.com/HackerNews/API). It supports free-text
search, a "posted within" filter, and newest/oldest sorting.

There is no backend. The browser calls the HN API directly through a typed
client generated from an OpenAPI spec, validates every response with Zod, and
searches and filters the cached list on the client.

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
| `npm run openapi:generate`   | Regenerate `src/api/hn/generated/` from the spec    |

The first time you run Playwright, install the browser with
`npx playwright install chromium`.

## API client (OpenAPI + hey-api)

Hacker News does not publish an OpenAPI spec, so this repo keeps its own:
[`openapi/hn-api.yaml`](openapi/hn-api.yaml) (OpenAPI 3.1). It was written from
the [official API docs](https://github.com/HackerNews/API) and checked against
live responses. It describes the whole v0 API, not only the endpoints the app
uses.

[`@hey-api/openapi-ts`](https://heyapi.dev) turns the spec into
`src/api/hn/generated/`:

| File           | Contents                                                     |
| -------------- | ------------------------------------------------------------ |
| `types.gen.ts` | TypeScript types (`Item`, `User`, response types, ...)       |
| `zod.gen.ts`   | Zod v4 schemas for every component and response              |
| `sdk.gen.ts`   | One function per operation (`getItem`, `getJobStories`, ...) |
| `client/`      | A small bundled fetch runtime (no extra runtime dependency)  |

Every SDK function validates the response body against its Zod schema.
`src/api/hn/client.ts` wraps those calls with retry and backoff, typed errors
(`HttpError`, `InvalidResponseError`), and narrowing to job items.

The generated files are committed. Don't edit them by hand. Change the spec and
run `npm run openapi:generate`.

**Why the generator lives in `tools/openapi-codegen/`:** the app uses
TypeScript 7, the native port, which has no JavaScript compiler API. hey-api
needs that API to print code. `tools/openapi-codegen` is a separate npm package
(with its own lockfile) that pins TypeScript 6 for the generator only. The
generated code is plain TypeScript and type-checks under the app's TS 7 strict
config. You can drop this package once hey-api supports TS 7.

## How it works

The HN API has no bulk, search, or paging endpoints:

- `GET /v0/jobstories.json` returns up to 200 job IDs, newest first.
- `GET /v0/item/{id}.json` returns one posting. It returns `null` with HTTP 200
  for unknown IDs. Older postings carry an HTML `text` body and an empty `url`.

The app loads the list in one TanStack Query (`src/api/hn/jobsQuery.ts`):

1. It fetches the ID list (`getJobStories`).
2. It fetches each item (`getItem`) with at most 10 requests in flight.
3. The generated SDK checks each item against the spec's `Item` schema.
   `src/api/hn/schemas.ts` then narrows it to a job and normalizes it into a
   `Job`. That step parses the company and YC batch from the title,
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
  api/hn/          Retrying client, job schema, query definition, filtering
  api/hn/generated/  hey-api output from openapi/hn-api.yaml (do not edit)
  components/      SearchBar, JobFilters, JobCard, JobList (one folder each)
  pages/JobsPage/  Page that composes the components
  routes/          TanStack Router file routes (route tree is generated)
  lib/             logger, formatting, concurrency helpers
  test/            Vitest setup and shared fixtures
e2e/               Playwright specs and API fixtures
openapi/           Hand-maintained OpenAPI 3.1 spec for the HN API
tools/openapi-codegen/  Isolated hey-api + TypeScript 6 generator package
```

## Not included yet

- **Paging.** The feed is about 30 to 200 items and the HN API cannot page, so
  the whole list is loaded at once.
