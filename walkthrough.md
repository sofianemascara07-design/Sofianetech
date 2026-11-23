# Security Summary

**Reviewed Files**: 28
**Issues Resolved**: 10

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Hardcoded Admin Credentials & VIP Keys | `src/components/LicenseGate.tsx`, `src/utils/licenseCrypto.ts`, `src/server/database.ts` | 1–280 | Admin passcodes, VIP license keys, and HMAC signing secrets were embedded directly in client-side source code and default fallbacks. | High | Fixed | Removed all hardcoded admin passcodes, VIP keys, and client-side HMAC secrets; admin authentication now requires either `ADMIN_PASSCODE` in server environment variables or a one-time first-run admin setup via `/api/admin/bootstrap`, verified exclusively with server-side salted `scrypt` hashes. |
| Persistent Token & Secret Storage in Browser | `src/utils/authSession.ts`, `src/utils/localPcAgent.ts`, `src/components/VaultDownloadsPanel.tsx` | 6–45 | Admin passcodes, Bearer session tokens, agent secrets, and subscriber mirrors were stored in `localStorage` and `sessionStorage`, exposing them to inspection and XSS extraction. | High | Fixed | Moved session Bearer tokens and PC agent credentials into JS module memory only (`authSession.ts`, `localPcAgent.ts`), purged legacy sensitive keys on startup, and switched authenticated requests and XHR uploads to `Authorization: Bearer` headers. |
| Missing Server-Side Auth & Role Enforcement | `server.ts` | 209–247 | Administrative, database, SDR prospect, vault management, and diagnostic endpoints relied on client flags or custom header passcodes instead of verified server sessions. | High | Fixed | Enforced `requireAuth` and `requireAdmin` middleware backed by signed server tokens across all protected routes (`/api/admin/*`, `/api/vault/*`, `/api/db/*`, `/api/sdr/*`, `/api/history/*`, `/api/credits/*`). |
| Unvalidated API Base URL Override (`?api=`) | `src/utils/apiBridge.ts` | 16–37 | A `?api=` URL query parameter or `localStorage` override allowed redirecting authenticated API calls and Bearer tokens to arbitrary third-party endpoints. | High | Fixed | Removed `?api=` query parameter parsing and `localStorage` backend overrides; the API base URL now resolves strictly from the build/runtime environment. |
| Excessive Metadata & Admin UI Exposure to Subscribers | `src/components/VaultDownloadsPanel.tsx`, `src/components/VaultSecurityLookup.tsx`, `src/components/DiagnosticHistory.tsx`, `src/components/CommercialPackaging.tsx` | 26–900 | Subscribers received and saw internal package SHA-256 hashes, allowed tier lists, download counts, database telemetry, destructive controls, and hosting/deploy commands. | Medium | Fixed | Introduced the minimized `SubscriberVaultPackage` response for `/api/vault/items` (returning only public catalog fields) and gated `VaultSecurityLookup`, admin actions, DB stats, and deployment panels behind `isAdmin`. |
| Exposed Local Agent & WebSocket Secrets | `src/components/LocalPcAgentPanel.tsx`, `src/components/AtelierCopilot.tsx`, `src/components/ConnectionManager.tsx` | 1–400 | Local agent ports (`127.0.0.1:38450`, `ws://127.0.0.1:8765`), default HMAC secrets (`AUTOPRO_DZ_LOCAL_SESSION_KEY_2026`), default agent credentials, and pairing batch scripts were visible to non-admin subscribers. | Medium | Fixed | Removed all default secrets and credentials from client state, stopped automatic unconfigured WebSocket connections, and hid agent tokens, script downloads, and port/registry internals from non-admin users. |
| Static Raw Backend Source Import in Client Bundle | `src/components/universal/PcmFlashCreditsModule.tsx` | 1–120 | Server Python source (`cloud_backend_fastapi.py?raw`) was bundled directly into the frontend client via Vite `?raw` import. | Medium | Fixed | Removed the static `?raw` backend Python import and download handler from the client bundle. |
| Hardcoded Default Emergency PIN & Bypass | `src/components/KeylessProximitySecurity.tsx`, `server.ts` | 77, 211, 694, 1836 | A hardcoded emergency PIN (`884926`) appeared in initial client state, offline fallback verification, and UI label hints. | Medium | Fixed | Removed the hardcoded default PIN, fallback bypass, and UI hint; PIN override verification now validates cleanly against the server endpoint `/api/keyless/emergency-action`. |
| Internal AI Provider & Engine Identifiers in UI | `src/components/AiVerificationBadge.tsx`, `src/components/UniversalMasterSuite.tsx`, `src/components/universal/AutoTunerFlexWorkflow.tsx` | 1–150 | Internal model names, credit balances, and low-level local port/filesystem paths were displayed to subscribers. | Low | Fixed | Replaced internal provider labels with generic verified status badges (`Contrôle Serveur Certifié`) and restricted credit management and low-level paths to admin sessions. |
| Server-Side Vault Download Bypass Risk | `server.ts` | 2542–2610 | Vault package downloads trusted client-supplied tier or license payloads in the request body instead of the authenticated server session. | High | Fixed | Server now derives the caller's tier, identity, and role exclusively from `req.authSession` (verified Bearer token) before authorizing package downloads. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Server Secrets | `server.ts`, `.env.example` | `GEMINI_API_KEY`, `GROQ_API_KEY`, `ADMIN_PASSCODE`, and `SESSION_HMAC_SECRET` are read strictly from server-side `process.env` and never bundled into `dist/`. |
| Session & Role Verification | `server.ts`, `src/utils/authSession.ts` | Auth tokens are verified via `requireAuth` and `requireAdmin` on every request; client-side state stores tokens exclusively in JavaScript module memory (`inMemoryAuthToken`). |
| Vault Access & Payload Minimization | `server.ts`, `src/server/database.ts` | `/api/vault/items` strips `sha256`, `allowedTiers`, and `downloads` for subscribers, and `/api/vault/download/:id` authorizes against the server-verified session tier. |
| Database Persistence | `src/server/database.ts` | SQLite queries use parameterized statements and admin passcodes are persisted only as salted `scrypt` digests. |

---

## PoC Verification

### 1. Unauthenticated / Subscriber Access to Admin Vault & Database Routes
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Server-Side Authorization & Privilege Escalation |
| Impact | High |
| Affected File | `server.ts:227-247` |
| Test Scenario | A subscriber or unauthenticated client sends `GET /api/admin/subscribers`, `GET /api/admin/vault/items`, or `POST /api/admin/vault/upload` with a subscriber Bearer token or spoofed `x-admin-passcode` header. |

#### How It Was Fixed
Removed header-based passcode bypasses and protected all administrative routes with `requireAdmin`, which validates the `Authorization: Bearer <token>` header against active server sessions and requires `session.role === 'admin'`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request hits `GET /api/admin/vault/items` (`server.ts:2476`) or `GET /api/db/stats` (`server.ts:4414`). | Enters `requireAdmin` middleware (`server.ts:227`) |
| 2 | `extractBearerToken(req)` parses `Authorization` header (`server.ts:201-207`) and calls `saasDatabase.verifyAuthToken(token)` (`server.ts:229`). | Missing/invalid tokens immediately return HTTP `401` (`server.ts:230-235`) |
| 3 | Valid subscriber token reaches role check `if (check.session.role !== 'admin')` (`server.ts:237`). | Request is rejected with HTTP `403 Accès réservé à l’administrateur` (`server.ts:238-242`) |

#### Conclusion
**Fix Verified** - Neither forged headers nor valid non-admin subscriber tokens can reach administrative routes or internal metadata endpoints.

---

### 2. Vault Tier Bypass via Forged Download Payload
#### Summary
| Field | Value |
|---|---|
| Issue Type | Client-Trusted Authorization Data |
| Impact | High |
| Affected File | `server.ts:2542` & `src/components/VaultDownloadsPanel.tsx:282` |
| Test Scenario | A Demo/Standard subscriber sends `POST /api/vault/download/<master-pkg-id>` with `{"tier": "master", "role": "admin"}` in the JSON body. |

#### How It Was Fixed
The client sends an empty JSON body `{}` (`VaultDownloadsPanel.tsx`), and the server route `/api/vault/download/:id` derives caller identity and tier exclusively from `req.authSession` populated by `requireAuth`, ignoring any client-supplied tier or role attributes.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request enters `app.post('/api/vault/download/:id', requireAuth, ...)` (`server.ts:2542`). | Token verified by `requireAuth` (`server.ts:209`) |
| 2 | Server sets `req.authSession` from the cryptographic server token store rather than `req.body`. | Spoofed `req.body.tier` / `req.body.role` is ignored |
| 3 | Package `allowedTiers` check evaluates against `req.authSession.tier` and `req.authSession.role`. | Unauthorized tier download is **Blocked (HTTP 403)** |

#### Conclusion
**Fix Verified** - Subscribers cannot elevate package download privileges by tampering with the request body.

---

### 3. Arbitrary Backend Redirection via `?api=` Query Parameter
#### Summary
| Field | Value |
|---|---|
| Issue Type | Untrusted API Origin Injection & Token Leakage |
| Impact | High |
| Affected File | `src/utils/apiBridge.ts:16-37` |
| Test Scenario | Visiting the app with `/?api=https://attacker.example` to divert `apiFetch()` requests and `Authorization: Bearer` headers to an external host. |

#### How It Was Fixed
Removed all `window.location.search` (`?api=`) parsing and `localStorage` backend URL persistence from `apiBridge.ts`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Application calls `apiFetch('/api/...')` (`src/utils/apiBridge.ts:123`). | Calls `apiUrl(input)` -> `getBackendBaseUrl()` (`src/utils/apiBridge.ts:16`) |
| 2 | `getBackendBaseUrl()` checks only `isFullStackSelfHost()`, `import.meta.env.VITE_API_URL`, or the built-in `DEFAULT_RENDER_BACKEND_URL` (`src/utils/apiBridge.ts:19-28`). | Query parameters and `localStorage` are never consulted |
| 3 | Auth Bearer header is attached (`src/utils/apiBridge.ts:99-102`) only to the trusted build/runtime backend origin. | **Handled Safely** |

#### Conclusion
**Fix Verified** - Query string injection cannot hijack API traffic or exfiltrate in-memory Bearer tokens.
