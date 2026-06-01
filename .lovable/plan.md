
# NetSem Major Upgrade — Implementation Plan

This is a very large scope (7 major features). To keep quality high and avoid regressions, I'll deliver it in **phases**, shipping each phase as a working, testable unit. You can review after each phase and redirect if needed.

---

## Phase 1 — Theme System (Dark / Light Mode)
- Add CSS variables for both themes in `src/styles.css` using your exact hex values (converted to oklch where needed for the existing token system, but mapped 1:1).
- `ThemeProvider` + `useTheme` hook in `src/components/ThemeProvider.tsx`, persisted in `localStorage` (`netsem_theme`), applied pre-hydration via inline script in `__root.tsx` to prevent flash.
- 32×32 round toggle button in `Navbar.tsx` (🌙 / ☀️) with 0.2s transitions.
- Audit and replace hardcoded colors in Lab components (canvas grid, cables, device nodes, minimap, modals) to use tokens.

## Phase 2 — Floating Terminal Drawer
- Remove the 384px right-side TerminalPanel from `LabSimulator.tsx`; canvas becomes full-width.
- New `TerminalDrawer.tsx` system:
  - Bottom tab bar (40px) with per-device pills, max 4 visible, horizontal scroll, close (✕) per pill.
  - Expanded drawer (default 280px, drag-resize 120–400px) overlays canvas, doesn't push it.
  - Per-device-type tabs inside drawer (Router: CLI/Interfaces/Routing, PC: Terminal/Network/WiFi, Server: Terminal/Services/Interfaces, AP: Wireless/Network/Clients, Firewall: CLI/Interfaces).
  - State managed in `useTerminalTabs` hook (open tabs, active tab, history retention).
  - Click device → open/focus tab (collapsed). Double-click → expand. Esc → collapse.
- Move existing TerminalPanel logic into the CLI tab content; reuse existing Interfaces/Routing/Services panels from `DeviceDesktop.tsx` (extract into shared components).

## Phase 3 — Smart CLI: Abbreviations + AI Autocomplete
- Add abbreviation resolver in `src/components/lab/cli/abbreviations.ts` — prefix match against mode-specific command list; unambiguous prefix executes, ambiguous shows matches (same as Tab).
- Apply expansion before existing command processor; covers full list you provided (`en`, `conf t`, `int g0/0`, `sh ip int br`, etc.).
- Autocomplete dropdown above input:
  - Instant local matches from current mode's command set.
  - Interface-aware: `int ` / `int g` / `int f` lists actual device interfaces filtered by prefix.
  - After 600ms pause + ≥2 chars + <3 local matches → background AI call via existing `ai-chat` server function, asking for 4 JSON-array suggestions. AI items prefixed ✨ in green.
  - Keyboard: ↑/↓ navigate, Enter selects (fills input only), Esc closes, click fills.
  - Spinner while waiting; max 6 visible, scrollable.

## Phase 4 — Real Network Simulation Engine
- Rewrite `networkEngine.ts` core:
  - `findIp(ip)` → device + interface lookup; fail fast if dest doesn't exist.
  - `sameSubnet(srcIp, srcMask, dstIp)` check.
  - BFS over `connections[]` treating switches as transparent L2.
  - For different subnets: require default gateway/static route on source; verify a router on path has interface in source subnet AND route (connected/static/OSPF) to destination subnet.
  - All four rules + specific failure reasons matching your spec.
- Path animation: green 8px SVG circle traveling exact cable polyline at ~600ms/hop using `requestAnimationFrame`, plus smaller return circle.
- Upgrade `PingResultPopup.tsx` to your new design: hop chain (clickable to select device), packet bar (`!!!!!` / `U.U.U.U.U`), RTT line, fix suggestions, 8s auto-dismiss with countdown bar, "Ask AI to fix" pre-fills topology JSON + reason into AI assistant.
- `traceroute` command shows numbered hop list.

## Phase 5 — Professional Courses Platform
- New route `/courses/$courseId/$lessonId` with sidebar + reader layout.
- Course data in `src/data/courses/` — one TS module per course with structured lesson content (headings, paragraphs, code blocks, tables, SVG diagrams, info boxes, quizzes). 8 courses, ~30 lessons total with **real** networking content (OSI, TCP/IP, subnetting, OSPF, VLANs, ACLs, NAT, WiFi standards, troubleshooting, CCNA).
- Reader components: `CourseSidebar`, `LessonReader`, `CodeBlock` (with copy + line numbers), `DataTable` (sortable, sticky header), inline SVG diagram components (OSI stack, subnet visual, NAT, VLAN, STP, ARP flow, OSPF areas, connectivity flowchart), `InfoBox` (tip/warning/remember/lab), `Quiz` component, `Certificate` modal.
- "Open in Lab" / LAB box → loads a preset topology into Lab via existing save/load.
- Progress persisted per user.

## Phase 6 — Auth & User Accounts (Lovable Cloud)
- Enable Lovable Cloud (Supabase under the hood) for real auth — needed because you want cross-device sync and a real signup/login flow. Guest mode still works against localStorage.
- `profiles` table (id FK → auth.users, name, username, avatar emoji, created_at) with RLS + auto-create trigger.
- `/signup` page: name, email, username (live availability check), password with strength bar + checklist, confirm, emoji avatar picker (15 options), success animation, redirect.
- `/login` page: email/username, password, remember me (30d), forgot password (→ `/reset-password`), "Continue as Guest".
- `AuthProvider` with `onAuthStateChange` listener; navbar shows avatar+username dropdown (Dashboard/Settings/Logout) or Login/Sign Up.
- `/settings`: profile edit, preferences (default theme, default device), API keys (move OpenAI key mgmt here), data export (JSON), clear data.
- Guest-to-account migration: on signup, copy `netsem_*` localStorage into user-scoped keys / DB.

## Phase 7 — Active Dashboard + Tracking + Responsive Polish
- `useTracker` hook + central event bus: every device add, cable, ping, command, save, AI message, login increments counters in `netsem_user_{id}_stats` (or Cloud table for logged-in users).
- XP/level system with floating "+N XP" animation on earn.
- Dashboard sections A–J: profile hero (avatar, streak, level, XP bar), 8 stat cards with count-up animation, 30-day activity line chart (pure SVG), ping success donut, device bar chart, top-5 commands, course progress, recent labs, achievements grid (8 badges with unlock conditions), GitHub-style 52-week heatmap.
- Real-time updates via `setInterval(30s)` reading from storage.
- Responsive pass across all pages: navbar hamburger <768px, courses sidebar → drawer on mobile, dashboard 4→2→1 column grid, lab usable on tablet (drawer adapts, toolbar wraps).

---

## Technical Notes
- All data: localStorage for guests; Lovable Cloud (Supabase) for authed users. No external chart libs — pure SVG.
- AI calls reuse existing `src/server/ai-chat.functions.ts`.
- All new UI uses semantic tokens from `src/styles.css` — no hardcoded colors.
- Each phase is independently shippable and won't break existing CLI/save/load/AI/AP/server/DHCP/OSPF features.

---

## Delivery Approach
Given the size (~40+ new files, ~15 edits, real course content writing), I propose shipping **one phase per turn**. I'll start with **Phase 1 (theme) + Phase 2 (floating terminal)** together since they're the most visible UX wins and the user is currently on the Lab page.

**Question before I start:** Are you OK with me **enabling Lovable Cloud** in Phase 6 for real auth (recommended), or do you want auth to stay 100% localStorage-based (simpler, but no real password security and no cross-device sync)?
