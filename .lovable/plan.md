
# NETSEM Lab Simulator — Major Upgrade Plan

This plan covers all changes scoped **exclusively** to the Lab/Workspace page.

---

## Phase 1: Pan/Zoom Canvas with Dot Grid

**Files:** `TopologyCanvas.tsx`, `src/styles.css`

- Add pan/zoom state (`scale`, `offsetX`, `offsetY`) using CSS `transform`
- Scroll wheel = zoom centered on cursor position
- Middle-click drag OR Space+drag = pan
- Replace line grid with dot grid background that moves with pan/zoom
- Add zoom in/out/fit-to-screen buttons (bottom-right corner)
- Add minimap in bottom-right showing full topology overview
- Update device positioning and connection lines to work in transformed coordinate space
- Fix drag-and-drop to account for transform offsets

## Phase 2: Device Toolbar + Laptop/AP in Toolbar

**Files:** `DeviceToolbar.tsx`

- Add Laptop and AccessPoint icons to the device toolbar (they already exist in DeviceIcons but aren't in the toolbar)

## Phase 3: Auto-Save Workspace Persistence

**Files:** `useLabState.ts`, `LabSimulator.tsx`

- Auto-save entire workspace state to `localStorage` on every change (devices, connections, positions, configs, routing tables, DHCP bindings, ARP tables, VLAN tables, services)
- Restore workspace state on page load — canvas appears exactly as left
- "Clear Lab" button explicitly clears workspace
- Save/Load named labs with proper modal UI instead of `prompt()` dialogs
- Restore `deviceCounter` and `connectionCounter` from loaded state

## Phase 4: Ping Result Popup

**Files:** `LabSimulator.tsx` (new PingResultPopup component), `TerminalPanel.tsx`, `networkEngine.ts`

- When `ping` runs from CLI, show floating popup with:
  - Source device + IP, destination IP
  - SUCCESS (green) or FAIL (red) with specific reason
  - Animated packet on canvas along the cable path
- Failure reasons: "No route to host", "Different subnet, no gateway", "Destination unreachable", "Interface down"
- "Ask AI" button linking to AI assistant with context

## Phase 5: Massively Expanded CLI

**Files:** `TerminalPanel.tsx` (refactored into separate command processor modules)

### Router/Switch IOS commands (all reading/writing real device state):
- All `show` commands from the spec (show ip route, show run, show interfaces, show cdp neighbors, show ip dhcp binding, show ip nat translations, show access-lists, etc.)
- Config modes: `config`, `config-if`, `config-router`, `dhcp-config`, `config-line`
- Routing protocols: `router ospf`, `router rip`, `router eigrp`, `router bgp` with `network` statements (simplified simulation)
- DHCP: `ip dhcp pool`, `network`, `default-router`, `dns-server`, `lease`, `ip dhcp excluded-address`
- NAT: `ip nat inside/outside`, `ip nat inside source list`
- ACL: `ip access-list extended`, `permit/deny` statements, `ip access-group`
- VLANs: `vlan [id]`, `name`, switchport commands
- STP: `spanning-tree mode`, `spanning-tree portfast`
- Security: `enable secret`, `banner motd`, `service password-encryption`, `line vty/console`, `login local`, `transport input ssh`
- Save: `copy running-config startup-config`, `write memory`, `copy run tftp`
- Debug: `debug ip icmp`, `no debug all`
- `clock set`, `show version` with uptime

### PC/Laptop CMD commands:
- `ipconfig`, `ipconfig /all`, `ipconfig /release`, `ipconfig /renew`
- `ping`, `tracert`, `arp -a`, `arp -d`, `nslookup`, `route print`, `netstat -an`, `netstat -r`

### Server Linux commands:
- `ifconfig`, `ip addr show`, `ip addr add`, `ip route show`, `ip route add`
- `ping`, `traceroute`, `arp -n`, `netstat -an`, `route -n`
- `service [dhcpd|named|vsftpd|apache2|syslogd] start/stop/status`
- `cat /var/log/syslog`

### Firewall ASA commands:
- `enable`, `configure terminal`
- `interface`, `nameif`, `security-level`, `ip address`, `no shutdown`
- `object network`, `nat (inside,outside) dynamic interface`
- `access-list extended permit/deny`
- `access-group [name] in interface [nameif]`
- `route outside 0.0.0.0 0.0.0.0 [next-hop]`
- `show conn`, `show xlate`, `show interface ip brief`, `show running-config`

### Access Point:
- No CLI. Terminal shows: "Access Points are configured via GUI only. Double-click to open admin panel."

### Context-aware tab autocomplete:
- Different command sets per mode (user/privileged/config/config-if/config-router/dhcp-config/config-line)
- Tab with multiple matches shows list below input
- Prompt updates dynamically with hostname changes

## Phase 6: Enhanced Desktop GUIs

**Files:** `DeviceDesktop.tsx` (major rewrite)

### PC/Laptop Desktop:
- Taskbar at bottom with app icons
- Desktop with app shortcuts
- Apps open as windows inside the popup:
  - **Network Settings**: IP, mask (dropdown /8 /16 /24 /25 /30), gateway, DNS, Static/DHCP toggle, Apply button, status indicator
  - **Wireless Settings** (PC + Laptop): Scan networks, show SSIDs from APs on canvas, signal strength bars, connect with password
  - **Terminal**: Full CMD terminal embedded
  - **Browser**: Address bar, shows fake webpage if HTTP server + DNS configured, else error page
  - **File Manager**: Basic simulated filesystem for TFTP

### Access Point Admin Panel:
- Tabs: Wireless Settings, Network Settings, Connected Clients, Security
- Wireless: SSID, password, channel (1-13), frequency 2.4/5GHz, broadcast toggle, max clients
- Network: WAN info, LAN IP, subnet, DHCP server toggle with pool config
- Connected Clients: table with hostname, MAC, IP, connection type, signal
- Security: admin password, firewall toggle, MAC filtering

### Server Admin Panel:
- Sidebar navigation with service sections
- DHCP Server: pool config, excluded addresses, active leases table
- DNS Server: A records, CNAME records, zone table, test resolve
- FTP Server: enable/disable, port, credentials
- TFTP Server: enable/disable, file list
- HTTP Server: enable/disable, ports, custom page content
- Syslog Server: enable/disable, log table
- NTP Server: enable/disable, stratum
- Embedded terminal

## Phase 7: Enhanced Network Engine

**Files:** `networkEngine.ts`, `types.ts`

- Routing protocol simulation (OSPF/RIP route learning between connected routers)
- DHCP lease assignment from pools
- ARP table population during ping
- VLAN isolation enforcement
- NAT translation tracking
- ACL filtering on ping paths
- DNS resolution through configured DNS servers

---

## Technical Notes

- All simulation logic in pure TypeScript, no backend
- localStorage for all persistence
- Existing dark terminal aesthetic preserved (green #22c55e accents)
- Canvas uses CSS transforms for pan/zoom (no canvas API)
- CLI command processor will be split into separate files per device type for maintainability
- Backward compatible with existing codebase structure
