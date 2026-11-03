import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// ---------------------------------------------------------------------------
// Content Security Policy
// ---------------------------------------------------------------------------

/** The only third-party origin the app talks to. */
const HN_API_ORIGIN = 'https://hacker-news.firebaseio.com'

/**
 * Builds the CSP string. The dev server needs two relaxations that a
 * production build must not have:
 *  - `'unsafe-inline'` scripts, because @vitejs/plugin-react injects an inline
 *    React Refresh preamble into index.html.
 *  - `ws:` connections, for Vite's HMR websocket.
 */
function buildCsp(isDev: boolean): string {
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': isDev
            ? ["'self'", HN_API_ORIGIN, 'ws:']
            : ["'self'", HN_API_ORIGIN],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
    }
    return Object.entries(directives)
        .map(([name, values]) => `${name} ${values.join(' ')}`)
        .join('; ')
}

/** Injects the CSP <meta> tag as the first element of <head>. */
function cspPlugin(): Plugin {
    let isDev = false
    return {
        name: 'hn-jobs-csp',
        configResolved(config) {
            isDev = config.command === 'serve'
        },
        transformIndexHtml() {
            return [
                {
                    tag: 'meta',
                    attrs: {
                        'http-equiv': 'Content-Security-Policy',
                        content: buildCsp(isDev),
                    },
                    injectTo: 'head-prepend',
                },
            ]
        },
    }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        // The router plugin must run before the React plugin so the generated
        // route tree is in place before JSX is transformed.
        tanstackRouter({ target: 'react', autoCodeSplitting: true }),
        react(),
        cspPlugin(),
    ],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        restoreMocks: true,
    },
})
