# NetSem Major Upgrade — Implementation Plan

This is a large-scope upgrade covering 6 major areas (bug fixes + new features).
To keep quality high and avoid regressions, delivery is split into **phases**,
each shipped as a working, testable unit. Review after each phase and redirect if needed.

---

## Phase 1 — Critical Lab Bug Fixes (Drag & Drop + Device Panel + CLI)

**Bug 1 — Drag & Drop broken:**
- Re-attach HTML5 drag events to all sidebar device icons in `DeviceToolbar.tsx`:
  `draggable="true"` + `ondragstart` setting `dataTransfer` with device type string.
- Re-attach drop zone events to the canvas container in `LabCanvas.tsx`:
  `ondragover: e.preventDefault()` + `ondrop: computeDropPosition()`.
- Drop position must account for current pan offset and zoom scale:
  `x = (e.clientX - rect.left - panX) / zoomScale`
  `y = (e.clientY - rect.top - panY) / zoomScale`
- Device node created at drop position, absolutely positioned inside canvas.
- Counter increments per type: Router1 → Router2 → Router3, etc.
- After drop → auto-select device and open its config panel.

**Bug 2 — Device config panel missing:**
- Restore right-side panel (300px) in `LabSimulator.tsx` that slides in on device click.
- Panel header: status dot (green/red) + device hostname + device type badge.
- Panel tabs per device type:
  - Router / Switch / Firewall → `[Console]` `[Interfaces]` `[Routing]`
  - PC / Laptop → `[Console]` `[Network Settings]`
  - Server → `[Console]` `[Services]`
  - Access Point → `[WiFi Config]` `[DHCP]` `[Clients]`
- Panel body: scrollable dark terminal output area (background `#0d1117`).
- Panel footer: sticky input row with current prompt + text input.
- Single click or double-click device → open/focus panel.
- Click ✕ or press Escape → close panel.
- Panel retains scroll position and command history per device between opens.

**Bug 3 — CLI input non-interactive:**
- Input field auto-focuses when panel opens.
- Enter key submits command, appended to output with prompt, scrolls to bottom.
- Arrow Up/Down cycles through command history.
- Tab triggers autocomplete.
- Restore minimum command set:
  `enable`, `configure terminal`, `hostname`, `interface`, `ip address`,
  `no shutdown`, `shutdown`, `show ip interface brief`, `show running-config`,
  `show ip route`, `exit`, `end`, `ping`, `help / ?`

**Bug 4 — Canvas interaction broken:**
- Device nodes draggable: `mousedown → mousemove → mouseup` with position update.
- Canvas pans with Space+drag or middle mouse button.
- Scroll wheel zooms in/out centered on cursor position.
- Click empty canvas → deselects device and closes panel.
- Right-click on device → context menu: `[Open Console]` `[Delete Device]` `[Rename]`.
- Connect flow: select device → click Connect button → click second device →
  interface selection modal with used/free status per interface.

---

## Phase 2 — Dark / Light Mode Theme Toggle

- Add CSS variable sets for both themes in `src/styles.css`:

  Dark (default):
  `--bg: #0d1117` `--bg2: #161b22` `--bg3: #21262d`
  `--text: #e6edf3` `--text2: #8b949e` `--border: #30363d`
  `--term-bg: #0a0e13` `--green: #22c55e`

  Light:
  `--bg: #f6f8fa` `--bg2: #ffffff` `--bg3: #f0f2f5`
  `--text: #1f2328` `--text2: #656d76` `--border: #d1d9e0`
  `--term-bg: #1e1e2e` (terminal stays dark even in light mode)
  `--green: #16a34a`

- `ThemeProvider` + `useTheme` hook, persisted in `localStorage('netsem_theme')`.
- Inline script in `__root.tsx` applies saved theme before hydration (prevents flash).
- 32×32 round toggle button in `Navbar.tsx`: 🌙 dark mode / ☀️ light mode.
- 0.2s CSS transition on all color changes.
- Audit all Lab components (canvas grid dots, cable colors, device nodes,
  minimap, modals, status bar) — replace any hardcoded colors with CSS tokens.

---

## Phase 3 — Smart CLI: Abbreviations + AI-Powered Autocomplete

**Part A — Cisco-style command abbreviations:**
- New `src/components/lab/cli/abbreviations.ts` with prefix resolver.
- Unambiguous prefix → execute immediately. Ambiguous → show match list (same as Tab).
- Full abbreviation map (minimum):
  `en` → enable, `conf t` → configure terminal,
  `int g0/0–g0/3` → interface GigabitEthernet0/0–3,
  `int f0/N` → interface FastEthernet0/N, `int e0` → interface Ethernet0,
  `sh ip int br` → show ip interface brief, `sh run` → show running-config,
  `sh ip ro` → show ip route, `sh int` → show interfaces,
  `sh arp` → show arp, `sh vlan br` → show vlan brief,
  `sh cdp nei` → show cdp neighbors,
  `sh ip nat tr` → show ip nat translations,
  `sh ip ospf nei` → show ip ospf neighbor,
  `sh ip dhcp bi` → show ip dhcp binding,
  `sh span` → show spanning-tree,
  `wr` → write memory, `no shut` → no shutdown, `shut` → shutdown,
  `ip add` → ip address, `sw mo ac` → switchport mode access,
  `sw mo tr` → switchport mode trunk, `sw ac vl` → switchport access vlan,
  `ip nat in` → ip nat inside, `ip nat out` → ip nat outside,
  `span port` → spanning-tree portfast,
  `copy run st` → copy running-config startup-config.
- Abbreviation expansion applied before existing command processor — no changes
  to existing CLI engine required.

**Part B — Real-time autocomplete dropdown:**
- Dropdown appears ABOVE the input row (never below), max 6 items, scrollable.
- Instant local matches from current mode command list on first keystroke.
- Interface-aware: typing `int ` → list actual device interfaces.
  `int g` → filter Gigabit only. `int f` → filter FastEthernet only.
- After 600ms pause + ≥2 chars + <3 local matches → background AI call:
  prompt: `"In Cisco IOS {mode} mode on a {device_type}, user typed '{input}'.
  Suggest 4 relevant commands. Reply ONLY with a JSON array of strings."`
  AI suggestions shown with ✨ prefix in green below local items.
- Clicking suggestion fills input (does NOT submit). Arrow ↑↓ navigate.
  Enter selects. Escape closes.
- Small spinner shows while waiting for AI response.
- Styling: `background: #21262d`, `border: 1px solid #30363d`,
  hover highlight in green, border-radius 6px on top corners only.

---

## Phase 4 — Real Network Simulation Engine

**Core simulation rules in `networkEngine.ts`:**

- Rule 1 — IP Required:
  Fail immediately if source has no UP interface with IP, or destination IP
  not found on any device. Error: `"Host unreachable — no IP address configured"`.

- Rule 2 — Same subnet (direct delivery):
  Check `(srcIp & mask) === (dstIp & mask)`.
  Success requires: both interfaces UP + BFS cable path exists.
  Switches are fully L2-transparent in BFS traversal (no IP needed).
  Fail: `"No physical path — check cable connections"`.

- Rule 3 — Different subnets (routed delivery):
  Requires: source has default gateway or static route → router on path with
  interface in source subnet (UP) + interface or route to destination subnet (UP).
  Physical path must exist: source → [switches] → router → [switches] → dest.
  Specific fail reason per missing condition.

- Rule 4 — Switch transparency:
  Switches forward at L2, never block same-subnet traffic, no IP required.

**Concrete test case (must pass):**
Router1 G0/0: 192.168.0.1/24 → connected to Switch1 F0/1
Switch1 F0/2 → PC1 Ethernet0: 192.168.0.10/24
Switch1 F0/3 → PC2 Ethernet0: 192.168.0.20/24
PC1 ping 192.168.0.20
→ Same subnet ✓ → BFS path exists ✓ → Both interfaces UP ✓
→ SUCCESS: animate PC1 → Switch1 → PC2, then return

**Packet animation:**
- Small green 8px SVG circle travels along exact cable polyline at ~600ms/hop.
- `requestAnimationFrame` for smooth motion.
- Smaller circle animates on return trip (ICMP reply).

**Ping result popup (centered modal, 360px, floats over workspace):**

Success layout:
✓  PING SUCCESSFUL
──────────────────────────────────
Source:       PC1 (192.168.0.10)
Destination:  PC2 (192.168.0.20)
──────────────────────────────────
Route:  PC1 → Switch1 → PC2
──────────────────────────────────
Packets:  !!!!!  5/5 (100%)
RTT:      min=1ms avg=2ms max=4ms
──────────────────────────────────
[Ask AI about this topology] [Close]

Failure layout:
✗  PING FAILED
──────────────────────────────────
Source:       PC1 (192.168.0.10)
Destination:  10.0.0.5
──────────────────────────────────
Result:  U.U.U.U.U  0/5 (0%)
──────────────────────────────────
Reason:
"Different subnets — source is
192.168.0.0/24, no router found
with route to 10.0.0.0/24"
──────────────────────────────────
How to fix:

Configure ip route on the router
Or enable OSPF on both routers
──────────────────────────────────
[🤖 Ask AI to fix this]  [Close]


- "Ask AI to fix this" → switches to AI tab, pre-fills message with topology JSON + reason.
- 8-second auto-dismiss with countdown progress bar.
- `traceroute` command shows numbered hop list with device name + IP + latency per hop.

---

## Phase 5 — Professional Courses Platform (PDF-Style Reader)

**Layout — split view:**
- Left sidebar (260px): course categories with expand/collapse, search box,
  per-course progress bar, difficulty badge, estimated time.
  Categories: 📡 Network Fundamentals, 🔀 Routing & Switching, 🔒 Security,
  📶 Wireless, 🛠️ Troubleshooting, 🎓 CCNA Prep.
- Right area: breadcrumb toolbar + Prev/Next pagination + zoom A−/A+ +
  in-page search with highlight + `[Open in Lab]` button + progress bar footer.
- Collapsible side notes panel: user writes personal notes per lesson,
  stored in `netsem_user_{id}_notes`.

**Content components:**
- `CodeBlock`: dark `#0d1117` bg, green syntax highlight, line numbers,
  device prompt colored differently, copy button top-right.
- `DataTable`: alternating row colors, sticky header, sortable columns.
- Inline SVG diagrams (drawn in code, not image placeholders):
  OSI 7-layer stack, TCP/IP encapsulation, IP binary breakdown,
  subnet visual, ARP request/reply flow, VLAN segmentation,
  NAT inside/outside translation, OSPF areas + neighbor states,
  STP root bridge topology, ACL permit/deny flowchart,
  troubleshooting connectivity decision tree.
- `InfoBox` variants: 💡 TIP (blue), ⚠️ WARNING (yellow),
  ✅ REMEMBER (green), 🔬 LAB (purple) — LAB box opens lab with preset topology.
- `Quiz` component: multiple choice, immediate feedback (✓/✗), explanation,
  score tracked per lesson.
- `Certificate` modal: shown on course completion, shows user name + course + date.

**Course content (real networking education, no placeholder text):**

Course 1 — Network Fundamentals (6 lessons):
OSI model (7 layers, PDUs, protocols per layer),
TCP/IP stack (4 layers, encapsulation, TCP vs UDP table),
IP addressing (classes, public/private, CIDR),
Subnetting (VLSM, worked examples, subnet calculator visual),
MAC & ARP (OUI format, request/reply flow diagram),
Network devices (hub vs switch vs router vs firewall comparison table).

Course 2 — Routing & Switching (8 lessons):
Static routing, RIP v2, OSPF (areas/DR/BDR/LSAs),
EIGRP (DUAL algorithm), BGP basics (eBGP/iBGP),
VLANs, Inter-VLAN routing (router-on-a-stick), Spanning Tree (PVST/RSTP).

Course 3 — Security & Firewall (5 lessons):
ACLs (standard/extended/wildcard/placement), NAT & PAT,
VPN & IPSec (phase 1/2, transform sets), Port security, SSH hardening.

Course 4 — Wireless Networking (3 lessons):
WiFi 802.11 standards comparison table, AP configuration, troubleshooting.

Course 5 — Troubleshooting (4 lessons):
OSI bottom-up methodology, show/debug commands guide,
common issues (duplicate IPs, wrong gateway), connectivity flowchart SVG.

Course 6 — CCNA Prep (4 lessons):
Exam overview, 20 practice questions with explanations,
command reference card table, subnetting cheat sheet /0–/32.

**Progress tracking:**
- "Mark as Complete" button per lesson.
- Completion stored in `netsem_user_{id}_progress`.
- Sidebar shows ✓ checkmark on completed lessons.
- Overall % shown on Dashboard.

---

## Phase 6 — User Account System (Signup / Login)

**Signup page `/signup` — 480px centered card:**
- Fields: Full Name, Email, Username (live availability check → ✓/✗),
  Password (eye toggle), Confirm Password.
- Password strength bar: Weak→Fair→Good→Strong with real-time checklist:
  8+ chars, uppercase, number, special character.
- Emoji avatar picker (15 options) during signup.
- `[Create Account]` full-width green button.
- Success animation (✓) → "Welcome, [Name]!" → auto-redirect to lab in 2s.
- "Already have an account? Log in →" link.

**Login page `/login` — 420px centered card:**
- Fields: Email or Username, Password (eye toggle), Remember me 30 days.
- `[Sign In]` full-width button, "Forgot password?" link, Sign up link.
- Divider "── or continue with ──" + `[🔑 Continue as Guest]` option.

**Session management:**
- Session stored in `localStorage`: `{ userId, username, email, name, avatar, token }`.
- Token expires: 30 days if Remember me ✓, else session-only.
- On page load: check valid session → auto-login silently.
- Logged-in navbar: avatar circle + username + dropdown
  `[Dashboard]` `[Settings]` `[Logout]`.
- Guest navbar: `[Login]` `[Sign Up]` buttons.
- Per-user localStorage keys:
  `netsem_user_{id}_labs` → saved labs
  `netsem_user_{id}_progress` → course progress
  `netsem_user_{id}_stats` → activity stats
  `netsem_user_{id}_notes` → course notes
- Guest-to-account migration: on signup, copy existing guest
  `netsem_*` localStorage data into user-scoped keys.

**Settings page `/settings`:**
- Profile: name, username, avatar emoji picker.
- Preferences: default theme, default device type.
- API Keys: OpenAI key management (moved from AI page).
- Data: `[Export all labs as JSON]` download + `[Clear all data]` with confirm.

---

## Phase 7 — Active Dashboard + Activity Tracking + XP System

**Auto-tracking (no user action needed):**
`useTracker` hook fires on every lab action, writes to `netsem_user_{id}_stats`:
- `devices_added: { router, switch, pc, laptop, server, ap, firewall }`
- `cables_drawn`, `pings_run: { total, successful, failed }`,
  `commands_typed`, `commands_by_type: { enable, show, configure, ping, ... }`,
  `labs_saved`, `labs_loaded`, `session_time_minutes`,
  `ai_messages_sent`, `last_active`, `login_dates[]`.

**XP + Level system:**
- Save lab: +10 XP | Complete lesson: +25 XP | Successful ping: +5 XP
  | 10 commands: +10 XP | AI message: +3 XP | 7-day streak: +100 XP.
- Levels: 1–100=Trainee, 101–300=Junior Engineer, 301–600=Network Engineer,
  601–1000=Senior Engineer, 1001+=Network Architect.
- Floating `+N XP` animation on earn (CSS keyframe, fades up and out).

**Dashboard sections (all pure SVG/Canvas, no chart libraries):**

A — Profile hero: avatar 64px, username, member since, 🔥 streak, ⭐ level,
    XP progress bar, `[Edit Profile]` button.

B — 8 animated stat cards (count-up on load):
    Labs Saved, Devices Created, Commands Typed, Lab Time,
    Pings Run, Course Progress %, AI Chats, Courses Completed.

C — Activity line chart (30 days): green SVG line + gradient fill,
    X=dates, Y=minutes, hover tooltip, tabs: 7d / 30d / All time.

D — Ping success donut chart (SVG): green=success %, red=fail %,
    center label, most common failure reason below.

E — Favorite devices horizontal bar chart (SVG, per device type count).

F — Top 5 commands ranked list with usage count bars.

G — Course progress bars: each course title + lesson count + `[Continue →]`.

H — Recent labs list (5 items): name, device count, last modified,
    `[Load]` `[Delete]` per row.

I — Achievements grid (8 badges):
    🏆 First Lab, 🔌 Well Connected, 📡 Router Master, 🌐 NAT Expert,
    🎓 CCNA Ready, 💬 AI Learner, 🔥 Dedicated, ⚡ Speed Config.
    Locked = greyed + 🔒. Unlocked = click shows name + date earned.

J — GitHub-style 52-week heatmap:
    Color by daily lab minutes:
    Empty=#21262d, Light=#16a34a, Medium=#22c55e, Heavy=#4ade80.
    Hover tooltip: "March 15 — 42 minutes".

**Real-time updates:** `setInterval(30s)` re-reads localStorage and
updates displayed numbers. Stat cards animate (count-up) on value change.

---

## Technical Requirements (all phases)

- **Data storage:** localStorage for all users. Use Lovable Cloud (Supabase)
  ONLY if natively available for real auth — otherwise pure localStorage.
- **Guest mode:** app fully functional without login. Guest save → prompt
  "Create a free account to sync labs across devices". Guest data migrates on signup.
- **Charts & diagrams:** pure SVG or Canvas only — no Chart.js, D3, or any
  external chart library.
- **Animations:** CSS transitions + `requestAnimationFrame` only.
- **Responsive:** all pages work at 375px+. Course sidebar collapses to
  hamburger on mobile. Dashboard: 4→2→1 column grid on tablet/mobile.
- **Performance:** course lessons rendered lazily (only active lesson in DOM).
  Dashboard charts render only when tab is visible (`IntersectionObserver`).
- **No regressions:** all existing features (CLI engine, save/load, AI assistant,
  DHCP, OSPF neighbors, running-config generation, AP/Server/PC panels,
  minimap, connect modal) keep working for both guest and logged-in users.
- **Theme:** all new components use CSS variables — zero hardcoded colors.

---

## Delivery Order

Given scope (~50 new/modified files), delivering one phase per turn:

**Starting with Phase 1 (Bug Fixes)** — this unblocks everything else
since the Lab is currently non-functional (drag & drop + panel broken).

After Phase 1 ships and you confirm it works, I proceed to Phase 2 (Theme),
then Phase 3 (CLI abbreviations), etc.

---

**One question before starting Phase 1:**
Should the device config panel restore as a **fixed right-side panel** (as it was
before, matching the reference topology screenshot), or do you prefer the new
**floating bottom drawer** design from the spec? Both are in scope — just
want to confirm which one to implement first.