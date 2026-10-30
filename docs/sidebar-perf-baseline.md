# Staff sidebar performance baseline

Measured on 2026-10-30 from a production Turbopack build (`next build --experimental-analyze`, Next.js 16.2.7) before the sidebar navigation changes. Interactive Chrome INP was not recorded: an unauthenticated request to `/admin_recruiter/home` is rejected by the proxy before the shell renders, and no staff session was available in this environment.

## How this was measured

- Production build: `npx next build --experimental-analyze` (compile 2.9 min, TypeScript 2.7 min, 353 static pages).
- Route JavaScript: `.next/diagnostics/route-bundle-stats.json`.
- Gzip: `zlib.gzipSync` level 9 on the emitted chunk files.
- Chunk contents: string search of the minified layout chunks (component text such as `Checking sign-in`, `Go to home`, `View as`, `admin-staff-module-access`).
- Unauthenticated document request against `next start`: `GET /admin_recruiter/home` returned **307** in **538 ms** to `/admin?next=/admin_recruiter/home` (37 bytes). The staff shell is not in that response.

## Route JavaScript

| Surface | Uncompressed JS | Gzip |
| --- | ---: | ---: |
| `/admin_recruiter/home` first load | 931,905 bytes (910 KB) | 267 KB |
| Chunks shared by all 89 `/admin_recruiter` routes | 919,801 bytes | 264 KB |
| Home page chunk beyond that shared set | 12,104 bytes | 3.7 KB |
| `/login` first load (comparison) | 951,845 bytes | 276 KB |

The home page itself is almost free. Nearly all of the JavaScript is the shared staff shell.

Chunks present on every admin route but not on `/login` (the staff shell):

| Chunk | Raw | Gzip | What the strings identify |
| --- | ---: | ---: | --- |
| `0h_ul3vm-eknc.js` | 47.7 KB | 12.5 KB | Shell, sidebar (`Go to home`), auth guard (`Checking sign-in`), header, view-as |
| `3bgkjj5-ktrkb.js` | 60.1 KB | 20.3 KB | `/api/admin/access` query, sidebar labels, `lucide`, account provider |
| **Staff shell total** | **108 KB** | **32.8 KB** | |

The other ~231 KB gzip is framework, React, and the Supabase browser client. Those chunks are also on `/login`. `framer-motion`, `recharts`, `mapbox`, and `emoji-picker` are not in the staff layout chunks. Lucide is not a whole icon pack in this graph; the sidebar icons are individual SVG files fetched after paint.

## Top three bottlenecks

### 1. The shell does not paint the real nav until two client round-trips finish

`AdminStaffAuthGuard` starts at `allowed = false`, so the server HTML for a signed-in user is the “Checking sign-in…” placeholder. Only after hydration does it call `getBrowserSession()`. The sidebar then mounts and `useStaffModuleAccess` fetches `/api/admin/access` with no `initialData`. Until that response arrives, `viewKeySet` is only `dashboard`, so the rest of the nav is missing.

Waterfall: document → hydrate the 264 KB gzip shell → Supabase session read → render sidebar → `GET /api/admin/access` → full nav.

There is no `loading.tsx` under `/admin_recruiter`, so a sidebar click also has nothing to show until the destination RSC finishes. Active styling is derived from `usePathname()`, which updates only after that navigation commits. Click-to-active is therefore the same as click-to-content, not under 50 ms.

### 2. A route change re-renders the shell and re-checks the session

`usePathname()` sits in `AdminRecruiterShell` (the whole client tree), the auth guard, the header, and the sidebar. The guard’s effect depends on `pathname`, so every click re-reads the Supabase session. Nav `<Link>` clicks themselves only close the mobile drawer; they do not await analytics. The extra work is the session effect and the shell re-render, not the link handler.

The sidebar does **not** remount across `/admin_recruiter/*` navigations. It already lives in `app/admin_recruiter/layout.tsx`.

### 3. The staff shell is one client component, but it is not a huge icon bundle

The layout file is a Server Component, then it immediately mounts `AdminRecruiterShell` (`"use client"`), which imports the sidebar, header, account provider, branding, toasts, and the view-as control. That island is **32.8 KB gzip** on top of the shared app runtime. Cutting a lucide barrel would not move the first-load number; the Supabase client (55 KB gzip, also on `/login`) is larger than the sidebar.

## Hypotheses that did not rank

| Hypothesis | Result |
| --- | --- |
| Layout remounts on every click | No. The sidebar is in the `/admin_recruiter` layout. |
| Whole icon pack or framer-motion in the sidebar | No. Icons are per-file SVGs fetched after paint. Motion and chart libraries are outside this chunk. |
| `prefetch={false}` or plain `<a>` / `router.push` for nav items | No. Items are `next/link` with default prefetch. Logout uses `router.push` only after `signOut()`. |
| Click handlers await analytics or refetch access | No for navigation clicks. The pathname effect re-reads the session, which is the extra click work. |

## Targets for the follow-up change

- First HTML includes the allowed nav items (no “Checking sign-in…” gate, no access-query skeleton when the server seed exists).
- `GET /api/admin/access` does not run on first load when the seed is present.
- Click marks the item active and shows the route `loading.tsx` skeleton before the destination RSC returns.
- Role save writes the returned `viewKeys` into the React Query cache immediately.
- Access cache key includes the tenant id and is cleared on view-as and sign-out.

## Result (same production build, after the sidebar change)

| Metric | Before | After |
| --- | ---: | ---: |
| `/admin_recruiter/home` uncompressed JS | 931,905 bytes | 934,561 bytes |
| Home first-load gzip | 267 KB | 268 KB |
| JS shared by all 89 admin routes, gzip | 264 KB | 264 KB |
| Staff shell chunks not on `/login`, gzip | 32.8 KB | 33.5 KB |
| “Checking sign-in…” in the client shell | yes | no |
| Route `loading.tsx` | none | content skeleton |
| Access query key | one global key | `["staff-access", tenantId]` |

The layout chunk did not get smaller. `optimizePackageImports` for `lucide-react` and `react-icons` did not move it: the sidebar icons are individual SVG files, and Lucide was already a couple of icons inside the shell chunk. The shell grew by about 0.7 KB gzip for the seeded query key, the pending-link marker, and the mobile drawer focus handling.

What changed instead of the byte count:

- The `/admin_recruiter` layout resolves the viewer’s grants with the existing cached session helpers and passes that record into React Query as `initialData`. A seeded render does not call `/api/admin/access` (covered by `use-staff-module-access.seed.test.tsx`).
- The auth guard no longer replaces the shell with “Checking sign-in…”. The proxy still redirects anonymous users before this HTML exists.
- A click sets the active item immediately, `useLinkStatus` marks the link pending, and `app/admin_recruiter/loading.tsx` swaps the content area for a skeleton while the layout and sidebar stay mounted.
- Saving a role returns the viewer’s current grants and writes them into the tenant-keyed cache. View-as and sign-out clear every `staff-access` cache entry.

Not done, with a reason:

- A global `staleTimes.dynamic` of 30 seconds. It would cache every dynamic route in the app, including applicant and onboarding pages that have to stay fresh.
- `prefetch={true}` on every item. That would run the authorization path for each visible link on load. Links keep the default: a light prefetch, with the full route on hover, and the loading skeleton makes the click feel immediate.
- Rewriting the sidebar markup into a server component. The filtered list is already in the server HTML via the seeded client island. The island is 33.5 KB gzip, and a markup split would not remove the pathname, collapse, or drawer state.

Still outside this change: the first document request now includes the grant read that used to be a follow-up fetch, destination pages still load their own data, and each sidebar icon still fetches its SVG after paint. Click-to-active and INP were not timed in Chrome; this environment has no staff session, and an anonymous request is a 307 before the shell renders.
