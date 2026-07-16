# Rate-Sentinel Frontend

This folder contains the React-based operator dashboard for `rate-sentinel`.

## What the UI Does

- Shows an interactive overview of the system and API surface
- Lets admins browse and manage rate-limit rules
- Lets operators generate and verify OTPs
- Lets users create payments with `Idempotency-Key` support
- Displays access-denied overlays when a protected area is unavailable

The experience includes a 3D particle background, glass-style panels, and tab-based navigation.

## Main Screens

- `Overview` — system summary, stats, endpoints, and rate-limit explanation
- `Rate Rules` — admin rule table and CRUD controls
- `OTP Tester` — OTP generation and verification forms
- `Payments` — payment creation and duplicate-request handling

## API Integration

- Backend base URL: `http://localhost:8080`
- Frontend dev server: `http://localhost:3000`
- JWT is attached as `Authorization: Bearer <token>` when present
- Form and JSON payloads are both used to match backend contracts

## Scripts

From the `frontend/` directory:

```powershell
npm install
npm start
npm test
npm run build
```

## Dependencies

The frontend uses:

- React 19
- React Three Fiber / Drei / Three.js for the animated background
- GSAP, Leva, Maath, and Zustand for UI/interaction support
- Testing Library for component and integration tests

## Notes

- This README is project-specific and replaces the default Create React App text.
- See the root `README.md` for the full project architecture and setup.
