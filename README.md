# RestaurantOS Local Hub — Forensic Audit & Diagnostic Report

## Forensic Analysis: Root Causes of Login Failures and "Authenticating..." Button Freeze

This document provides a forensic audit detailing the exact mechanisms causing login failures, secondary device connectivity locks, and the permanent "Authenticating..." button freeze in RestaurantOS Point of Sale (POS).

---

### Root Cause 1: QR Code Origin Misbinding (`localhost` vs Physical Wi-Fi LAN IP)

* **Location:** `src/components/admin/StaffManagement.tsx`
* **Mechanism:** When an administrator opens the Admin panel on the main PC at `http://localhost:8989` or `http://127.0.0.1:8989`, `window.location.origin` evaluates to `http://localhost:8989`. The generated QR code embeds the URL `http://localhost:8989/pair?token=...`.
* **The Failure:** When a staff member scans this QR code with a smartphone on the restaurant's local Wi-Fi, the phone attempts to connect to `localhost` on the phone itself rather than the Hub PC, causing an immediate `ERR_CONNECTION_REFUSED` network error.
* **Permanent Fix Strategy:** In `StaffManagement.tsx`, pairing URLs must dynamically prioritize the Hub PC’s physical LAN IPv4 address (e.g. `http://192.168.1.50:8989`) returned by `POST /api/admin/pairing/generate` rather than falling back to `window.location.origin` when running on `localhost`.

---

### Root Cause 2: CORS Preflight Block on Secondary Network Devices

* **Location:** `server.ts` middleware pipeline.
* **Mechanism:** Mobile browser PWAs making cross-origin HTTP requests (e.g. connecting from `http://192.168.1.x:8989`) issue `OPTIONS` preflight requests when sending JSON payloads containing headers like `Authorization` or `Content-Type`.
* **The Failure:** If Express or upstream handlers do not return `204 No Content` with `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: Authorization, Content-Type, x-request-id`, the mobile browser blocks the request before it ever reaches `/api/auth/login` or `/api/auth/pair`.
* **Permanent Fix Strategy:** Ensure explicit, global CORS headers and an early `OPTIONS` preflight handler (`res.sendStatus(204)`) are positioned at the very top of `server.ts` before any route middleware.

---

### Root Cause 3: Unhandled Async State Lock in `LoginScreen.tsx` & `App.tsx`

* **Location:** `src/components/LoginScreen.tsx` (`handleSubmit`) & `src/App.tsx` (`checkStatus` / `initApp`).
* **Mechanism:** When a user clicks **Sign In to Local Hub**, `LoginScreen` sets `loading = true` ("Authenticating..."). Upon receiving HTTP 200, `LoginScreen` calls `onLogin(token)`. In `App.tsx`, `handleLogin` calls `checkStatus(token)` and `initApp(token)`.
* **The Failure:** If `/api/auth/me` or `/api/state` encounters a network delay, WAL database lock, or socket reconnection pause, `App.tsx` remains in `'LOGIN'` state while `LoginScreen`'s `loading` flag stays `true`. Because `onLogin` never unmounts `LoginScreen` or resets `loading`, the button stays stuck on **"Authenticating..."** permanently without displaying an error.
* **Permanent Fix Strategy:**
  1. Pass the authenticated `user` object directly from `POST /api/auth/login` into `onLogin(token, user)`, allowing `App.tsx` to instantly transition `appState` to `'APP'`.
  2. Wrap `onLogin` in a `try/catch/finally` block inside `LoginScreen.tsx` so `setLoading(false)` always executes if an exception occurs.
