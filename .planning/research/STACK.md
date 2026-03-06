# Stack Research: upnext

**Date:** 2026-03-06
**Source:** Direct inspection of MediaTrackerPlus at `/Users/lucas.rancez/Documents/Code/MediaTrackerPlus`

## MediaTrackerPlus Runtime Stack (Source of Truth)

These versions were confirmed from `server/package.json` and `client/package.json`.

### Server (Backend)
| Package | Version | Role |
|---------|---------|------|
| `express` | 4.21.2 | HTTP server / routing |
| `typescript` | 4.9.5 | Language |
| `knex` | 3.1.0 | Query builder + migrations |
| `better-sqlite3` | 11.7.0 | SQLite driver |
| `pg` | 8.7.3 | PostgreSQL driver |
| `axios` | 0.29.0 | HTTP client (external API calls) |
| `winston` | 3.17.0 | Structured logging |
| `jest` | 28.1.3 | Test runner |
| `supertest` | 6.3.4 | HTTP integration testing |
| `babel-jest` | 28.1.3 | Jest transform (CommonJS) |
| `@types/express` | 4.17.21 | Express TypeScript types |
| `@types/better-sqlite3` | 7.6.12 | SQLite types |
| `dotenv` | 16.4.7 | Environment config |

### Module System
- **CommonJS** (`"module": "commonjs"` in `tsconfig.json`)
- `noEmit: true` in base tsconfig (tests run via babel-jest without separate compile step)
- Target: `ES2020`

### Test Configuration
- Jest with `babel-jest` transform (not `ts-jest`)
- `testEnvironment: "node"`
- No coverage thresholds set
- Integration tests use `supertest` against live in-memory app

---

## upnext Sidecar Stack Recommendation

The sidecar should mirror MediaTrackerPlus's stack precisely to minimise cognitive friction and ensure compatible tooling.

### Runtime Dependencies (sidecar-specific)
| Package | Version | Rationale |
|---------|---------|-----------|
| `express` | `^4.21.2` | Match MediaTrackerPlus exactly |
| `axios` | `^0.29.0` | Same axios version as MediaTrackerPlus for consistent behaviour |
| `winston` | `^3.17.0` | Same logger as MediaTrackerPlus |
| `dotenv` | `^16.4.7` | Env config (TMDB_KEY, IGDB_CLIENT_ID, etc.) |

### Dev Dependencies (sidecar-specific)
| Package | Version | Rationale |
|---------|---------|-----------|
| `typescript` | `^4.9.5` | Match MediaTrackerPlus |
| `jest` | `^28.1.3` | Match MediaTrackerPlus |
| `supertest` | `^6.3.4` | HTTP integration tests against sidecar webhook receiver |
| `babel-jest` | `^28.1.3` | Same transform strategy — no separate compile step needed |
| `@babel/core` | `^7.x` | Required by babel-jest |
| `@babel/preset-env` | `^7.x` | CommonJS transform |
| `@babel/preset-typescript` | `^7.x` | TypeScript transform |
| `@types/express` | `^4.17.21` | Match MediaTrackerPlus |
| `@types/jest` | `^28.x` | Jest types |
| `@types/supertest` | `^2.x` | Supertest types |
| `@types/node` | `^18.x` | Node.js types |

**Not needed in sidecar:**
- `knex` — sidecar has no database (stateless, writes back via MediaTrackerPlus REST API)
- `better-sqlite3` / `pg` — same reason
- `react` / frontend packages — sidecar is API-only

### tsconfig Alignment
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": false
  }
}
```

Note: Unlike MediaTrackerPlus (which uses `noEmit: true` for test-only builds), the sidecar needs actual compilation to produce a runnable `dist/` for deployment. Use a separate `tsconfig.build.json` that omits test files.

---

## Key Patterns from MediaTrackerPlus

### HTTP Client Pattern (axios)
MediaTrackerPlus wraps axios calls in a `RequestQueue` with 250ms throttle for rate-limited APIs (IGDB). The sidecar should implement the same pattern:
```typescript
// From: server/src/metadata/provider/igdb.ts
class RequestQueue {
  private queue: (() => void)[] = [];
  private processing = false;
  private readonly delay = 250; // 4 req/sec
  // ...
}
```

### Error Handling Pattern
MediaTrackerPlus uses `try/catch` at the controller level and returns HTTP error codes. The sidecar should follow the same convention for its webhook receiver endpoint.

### Logger Pattern
```typescript
// From: server/src/logger.ts
import winston from 'winston';
export const logger = winston.createLogger({
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
});
```
Sidecar creates its own logger instance with the same shape.

### Babel Jest Config
MediaTrackerPlus uses this `babel.config.js` pattern (from inspection):
```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
  ],
};
```
The sidecar reuses this config verbatim.

---

## External API Credentials Configuration

The sidecar needs these environment variables (matching names already used in MediaTrackerPlus where applicable):

| Variable | Source | Notes |
|----------|--------|-------|
| `TMDB_LANG` | `.env` | `en-US` (match MediaTrackerPlus default) |
| `TMDB_API_KEY` | `.env` | Free TMDB account |
| `IGDB_CLIENT_ID` | `.env` | Twitch dev app |
| `IGDB_CLIENT_SECRET` | `.env` | Twitch dev app |
| `MEDIATRACKER_BASE_URL` | `.env` | e.g. `http://localhost:7481` |
| `MEDIATRACKER_ACCESS_TOKEN` | `.env` | Created in MediaTrackerPlus admin |
| `WEBHOOK_SECRET` | `.env` | Shared HMAC secret (also set in fork config) |
| `PORT` | `.env` | Default `3001` |

---

## Summary

The upnext sidecar is a lean Node.js/TypeScript Express service that mirrors MediaTrackerPlus's dependency choices for consistency. It is **stateless** (no database), communicates exclusively via HTTP (outbound: TMDB/IGDB/OpenLibrary/MediaTrackerPlus REST API; inbound: MediaTrackerPlus webhooks), and uses the same test toolchain as the fork to keep integration test patterns uniform.

Total unique runtime dependencies: **4** (express, axios, winston, dotenv).
