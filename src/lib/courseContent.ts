export interface Lesson {
  id: string;
  title: string;
  body: string; // markdown-ish
  diagram?: string; // inline SVG markup — concept architecture for this lesson
  readMinutes?: number;
}

// ============ Concept Architecture Diagrams (inline SVG) ============
// All diagrams use currentColor + CSS variables so they adapt to themes.
const SVG = (inner: string, w = 640, h = 280) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto" style="color:hsl(var(--foreground))">${inner}</svg>`;

const OSI_DIAGRAM = SVG(`
  <defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".25"/><stop offset="1" stop-color="#a855f7" stop-opacity=".25"/></linearGradient></defs>
  ${[
    ['7 · Application','HTTP, DNS, SMTP'],
    ['6 · Presentation','TLS, encoding'],
    ['5 · Session','Sessions, sockets'],
    ['4 · Transport','TCP / UDP, ports'],
    ['3 · Network','IP, routers'],
    ['2 · Data Link','MAC, switches'],
    ['1 · Physical','Cables, signals'],
  ].map(([t, s], i) => `
    <g transform="translate(40,${20 + i * 34})">
      <rect width="560" height="28" rx="6" fill="url(#g1)" stroke="currentColor" stroke-opacity=".35"/>
      <text x="14" y="19" font-family="ui-monospace,monospace" font-size="13" fill="currentColor">${t}</text>
      <text x="560" y="19" text-anchor="end" font-size="11" fill="currentColor" opacity=".6" font-family="ui-sans-serif" dx="-12">${s}</text>
    </g>`).join('')}
`, 640, 280);

const TCPIP_DIAGRAM = SVG(`
  ${[
    ['Application','HTTP · DNS · SSH','#a855f7'],
    ['Transport','TCP · UDP','#22d3ee'],
    ['Internet','IP · ICMP','#10b981'],
    ['Link','Ethernet · Wi-Fi','#f59e0b'],
  ].map(([t, s, c], i) => `
    <g transform="translate(60,${30 + i * 52})">
      <rect width="520" height="44" rx="8" fill="${c}" fill-opacity=".15" stroke="${c}" stroke-opacity=".5"/>
      <text x="20" y="20" font-size="14" font-family="ui-monospace,monospace" fill="currentColor">${t}</text>
      <text x="20" y="36" font-size="11" fill="currentColor" opacity=".6">${s}</text>
    </g>`).join('')}
  <g stroke="currentColor" stroke-opacity=".4" stroke-dasharray="4 3">
    <path d="M 590 50 v 180" marker-end="url(#arr)"/>
  </g>
  <defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
  <text x="600" y="140" font-size="10" fill="currentColor" opacity=".5" transform="rotate(90 600 140)">Encapsulation</text>
`, 640, 260);

const SUBNET_DIAGRAM = SVG(`
  <text x="320" y="30" text-anchor="middle" font-size="14" font-family="ui-monospace,monospace" fill="currentColor">192.168.1.0 / 24</text>
  ${Array.from({ length: 32 }, (_, i) => {
    const isNet = i < 24;
    const x = 40 + i * 17;
    return `<g><rect x="${x}" y="60" width="14" height="36" rx="3" fill="${isNet ? '#22d3ee' : '#f59e0b'}" fill-opacity=".7"/><text x="${x + 7}" y="84" text-anchor="middle" font-size="10" fill="#000">${isNet ? '1' : '0'}</text></g>`;
  }).join('')}
  <text x="40" y="120" font-size="11" fill="currentColor" opacity=".7">← 24 network bits</text>
  <text x="600" y="120" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">8 host bits →</text>
  <g transform="translate(60,160)">
    <rect width="240" height="80" rx="8" fill="#22d3ee" fill-opacity=".1" stroke="#22d3ee" stroke-opacity=".5"/>
    <text x="14" y="24" font-size="12" fill="currentColor">Network</text>
    <text x="14" y="46" font-family="ui-monospace,monospace" font-size="13" fill="currentColor">192.168.1.0</text>
    <text x="14" y="66" font-size="11" fill="currentColor" opacity=".6">Broadcast .255 · 254 usable</text>
  </g>
  <g transform="translate(340,160)">
    <rect width="240" height="80" rx="8" fill="#f59e0b" fill-opacity=".1" stroke="#f59e0b" stroke-opacity=".5"/>
    <text x="14" y="24" font-size="12" fill="currentColor">Hosts</text>
    <text x="14" y="46" font-family="ui-monospace,monospace" font-size="13" fill="currentColor">.1 → .254</text>
    <text x="14" y="66" font-size="11" fill="currentColor" opacity=".6">First and last reserved</text>
  </g>
`, 640, 260);

const ARP_DIAGRAM = SVG(`
  <g transform="translate(40,80)"><rect width="140" height="80" rx="10" fill="#22d3ee" fill-opacity=".15" stroke="#22d3ee" stroke-opacity=".5"/><text x="70" y="32" text-anchor="middle" font-size="12" fill="currentColor">Host A</text><text x="70" y="52" text-anchor="middle" font-size="11" font-family="ui-monospace,monospace" fill="currentColor">192.168.1.10</text><text x="70" y="68" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">aa:bb:cc:00:00:01</text></g>
  <g transform="translate(460,80)"><rect width="140" height="80" rx="10" fill="#a855f7" fill-opacity=".15" stroke="#a855f7" stroke-opacity=".5"/><text x="70" y="32" text-anchor="middle" font-size="12" fill="currentColor">Host B</text><text x="70" y="52" text-anchor="middle" font-size="11" font-family="ui-monospace,monospace" fill="currentColor">192.168.1.1</text><text x="70" y="68" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">aa:bb:cc:00:00:02</text></g>
  <g stroke="currentColor" fill="none">
    <path d="M 180 100 C 280 60 360 60 460 100" stroke="#22d3ee" stroke-width="2" marker-end="url(#a1)"/>
    <path d="M 460 140 C 360 180 280 180 180 140" stroke="#10b981" stroke-width="2" marker-end="url(#a2)"/>
  </g>
  <defs>
    <marker id="a1" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#22d3ee"/></marker>
    <marker id="a2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#10b981"/></marker>
  </defs>
  <text x="320" y="50" text-anchor="middle" font-size="11" fill="currentColor" opacity=".8">1. Who has 192.168.1.1? (broadcast)</text>
  <text x="320" y="210" text-anchor="middle" font-size="11" fill="currentColor" opacity=".8">2. I do — aa:bb:cc:00:00:02</text>
`, 640, 260);

const OSPF_DIAGRAM = SVG(`
  ${[
    [180, 80, 'R1'], [460, 80, 'R2'], [180, 200, 'R3'], [460, 200, 'R4'], [320, 140, 'R5'],
  ].map(([x, y, n]) => `<g><circle cx="${x}" cy="${y}" r="28" fill="#22d3ee" fill-opacity=".15" stroke="#22d3ee" stroke-opacity=".6" stroke-width="2"/><text x="${x}" y="${(y as number) + 5}" text-anchor="middle" font-size="13" font-family="ui-monospace,monospace" fill="currentColor">${n}</text></g>`).join('')}
  <g stroke="currentColor" stroke-opacity=".5" stroke-width="1.5" fill="none">
    <line x1="208" y1="80" x2="432" y2="80"/>
    <line x1="208" y1="200" x2="432" y2="200"/>
    <line x1="180" y1="108" x2="180" y2="172"/>
    <line x1="460" y1="108" x2="460" y2="172"/>
    <line x1="200" y1="100" x2="295" y2="125"/>
    <line x1="440" y1="100" x2="345" y2="125"/>
    <line x1="200" y1="180" x2="295" y2="155"/>
    <line x1="440" y1="180" x2="345" y2="155"/>
  </g>
  <text x="320" y="30" text-anchor="middle" font-size="13" fill="currentColor">Area 0 — Link-State Database</text>
  <text x="320" y="260" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">Every router shares LSAs → builds identical topology graph → runs Dijkstra</text>
`, 640, 280);

const VLAN_DIAGRAM = SVG(`
  <g transform="translate(180,30)"><rect width="280" height="60" rx="8" fill="#a855f7" fill-opacity=".15" stroke="#a855f7" stroke-opacity=".5"/><text x="140" y="36" text-anchor="middle" font-size="13" font-family="ui-monospace,monospace" fill="currentColor">Switch</text></g>
  ${[
    [60, 180, 'PC1', '#22d3ee', 'VLAN 10'],
    [200, 180, 'PC2', '#22d3ee', 'VLAN 10'],
    [360, 180, 'PC3', '#f59e0b', 'VLAN 20'],
    [520, 180, 'PC4', '#f59e0b', 'VLAN 20'],
  ].map(([x, y, n, c, v]) => `<g><rect x="${(x as number) - 30}" y="${y}" width="60" height="50" rx="6" fill="${c}" fill-opacity=".15" stroke="${c}" stroke-opacity=".6"/><text x="${x}" y="${(y as number) + 22}" text-anchor="middle" font-size="12" fill="currentColor">${n}</text><text x="${x}" y="${(y as number) + 40}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">${v}</text><line x1="${x}" y1="${y}" x2="${(x as number) < 320 ? 250 : 390}" y2="90" stroke="${c}" stroke-opacity=".5"/></g>`).join('')}
  <text x="320" y="270" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">One physical switch → two broadcast domains. PC1↔PC3 needs a router.</text>
`, 640, 290);

const NAT_DIAGRAM = SVG(`
  <g transform="translate(30,90)"><rect width="180" height="80" rx="10" fill="#22d3ee" fill-opacity=".15" stroke="#22d3ee" stroke-opacity=".5"/><text x="90" y="28" text-anchor="middle" font-size="12" fill="currentColor">Private LAN</text><text x="90" y="50" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="currentColor">10.0.0.10</text><text x="90" y="66" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="currentColor">10.0.0.11</text></g>
  <g transform="translate(260,90)"><rect width="120" height="80" rx="10" fill="#a855f7" fill-opacity=".15" stroke="#a855f7" stroke-opacity=".5"/><text x="60" y="32" text-anchor="middle" font-size="12" fill="currentColor">NAT Router</text><text x="60" y="56" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="currentColor">203.0.113.5</text></g>
  <g transform="translate(430,90)"><rect width="180" height="80" rx="10" fill="#10b981" fill-opacity=".15" stroke="#10b981" stroke-opacity=".5"/><text x="90" y="28" text-anchor="middle" font-size="12" fill="currentColor">Internet</text><text x="90" y="56" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">Sees only the public IP</text></g>
  <g stroke="currentColor" stroke-opacity=".5" fill="none" marker-end="url(#a3)"><line x1="210" y1="130" x2="260" y2="130"/><line x1="380" y1="130" x2="430" y2="130"/></g>
  <defs><marker id="a3" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
  <text x="320" y="220" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">PAT distinguishes flows by source port: 10.0.0.10:5000 ↔ 203.0.113.5:40001</text>
`, 640, 250);

const STP_DIAGRAM = SVG(`
  <g><circle cx="320" cy="50" r="26" fill="#10b981" fill-opacity=".25" stroke="#10b981" stroke-width="2"/><text x="320" y="55" text-anchor="middle" font-size="12" fill="currentColor">Root</text></g>
  ${[[150, 160, 'S2'], [490, 160, 'S3']].map(([x, y, n]) => `<g><circle cx="${x}" cy="${y}" r="24" fill="#22d3ee" fill-opacity=".15" stroke="#22d3ee" stroke-width="2"/><text x="${x}" y="${(y as number) + 5}" text-anchor="middle" font-size="12" fill="currentColor">${n}</text></g>`).join('')}
  <g stroke="#10b981" stroke-width="2" fill="none"><line x1="300" y1="70" x2="170" y2="140"/><line x1="340" y1="70" x2="470" y2="140"/></g>
  <g stroke="#ef4444" stroke-width="2" stroke-dasharray="6 4" fill="none"><line x1="170" y1="184" x2="470" y2="184"/></g>
  <text x="320" y="220" text-anchor="middle" font-size="11" fill="#ef4444" opacity=".8">Blocked port — prevents the loop</text>
  <text x="320" y="245" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">Root bridge = lowest priority + MAC. Non-roots pick their best path; redundant links block.</text>
`, 640, 270);

const WIFI_DIAGRAM = SVG(`
  <g transform="translate(280,30)"><rect width="80" height="50" rx="8" fill="#a855f7" fill-opacity=".15" stroke="#a855f7" stroke-opacity=".6"/><text x="40" y="30" text-anchor="middle" font-size="12" fill="currentColor">AP</text></g>
  ${[[80, 180], [220, 180], [400, 180], [540, 180]].map(([x, y], i) => `<g><rect x="${(x as number) - 30}" y="${y}" width="60" height="45" rx="6" fill="#22d3ee" fill-opacity=".15" stroke="#22d3ee" stroke-opacity=".5"/><text x="${x}" y="${(y as number) + 26}" text-anchor="middle" font-size="11" fill="currentColor">STA${i + 1}</text></g>`).join('')}
  <g stroke="#a855f7" stroke-opacity=".4" stroke-dasharray="3 3" fill="none">${[80, 220, 400, 540].map(x => `<line x1="320" y1="80" x2="${x}" y2="180"/>`).join('')}</g>
  ${[120, 150, 180].map(r => `<circle cx="320" cy="80" r="${r}" fill="none" stroke="#a855f7" stroke-opacity=".${30 - (r - 120) / 4}"/>`).join('')}
  <text x="320" y="260" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">SSID broadcast · WPA2/WPA3 handshake · clients associate with the AP</text>
`, 640, 280);

const PING_DIAGRAM = SVG(`
  <g transform="translate(40,100)"><rect width="120" height="60" rx="8" fill="#22d3ee" fill-opacity=".15" stroke="#22d3ee" stroke-opacity=".5"/><text x="60" y="36" text-anchor="middle" font-size="12" fill="currentColor">Source</text></g>
  <g transform="translate(260,100)"><rect width="120" height="60" rx="8" fill="#a855f7" fill-opacity=".15" stroke="#a855f7" stroke-opacity=".5"/><text x="60" y="36" text-anchor="middle" font-size="12" fill="currentColor">Router</text></g>
  <g transform="translate(480,100)"><rect width="120" height="60" rx="8" fill="#10b981" fill-opacity=".15" stroke="#10b981" stroke-opacity=".5"/><text x="60" y="36" text-anchor="middle" font-size="12" fill="currentColor">Target</text></g>
  <g stroke="#22d3ee" stroke-width="2" fill="none" marker-end="url(#aE)"><line x1="160" y1="120" x2="260" y2="120"/><line x1="380" y1="120" x2="480" y2="120"/></g>
  <g stroke="#10b981" stroke-width="2" fill="none" stroke-dasharray="4 4" marker-end="url(#aE2)"><line x1="480" y1="145" x2="380" y2="145"/><line x1="260" y1="145" x2="160" y2="145"/></g>
  <defs>
    <marker id="aE" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#22d3ee"/></marker>
    <marker id="aE2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#10b981"/></marker>
  </defs>
  <text x="210" y="90" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">ICMP echo →</text>
  <text x="430" y="180" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">← echo reply</text>
`, 640, 230);

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: number; // index
}

export interface CourseDef {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
  topics: string[];
  lessons: Lesson[];
  quiz: Quiz[];
}

export const COURSES: CourseDef[] = [
  {
    id: 'fundamentals',
    title: 'Network Fundamentals',
    description: 'OSI, TCP/IP, IP addressing, and how data travels across networks.',
    difficulty: 'beginner',
    icon: '🌐',
    topics: ['OSI Model', 'TCP/IP', 'IP Addressing', 'Subnetting'],
    lessons: [
      { id: 'osi', title: 'The OSI Model', readMinutes: 5,
        diagram: OSI_DIAGRAM,
        body: `# The OSI Model\n\nThe **Open Systems Interconnection (OSI)** model defines 7 layers:\n\n1. **Physical** — cables, signals, voltages\n2. **Data Link** — MAC addresses, Ethernet, switches\n3. **Network** — IP addresses, routers, packets\n4. **Transport** — TCP/UDP, ports, segments\n5. **Session** — sessions between applications\n6. **Presentation** — encoding, encryption\n7. **Application** — HTTP, DNS, SMTP\n\n## Why it matters\n\nEach layer encapsulates the data of the layer above and passes it down. When data arrives at the destination, layers are stripped off in reverse.` },
      { id: 'tcpip', title: 'TCP/IP Stack', readMinutes: 4,
        diagram: TCPIP_DIAGRAM,
        body: `# TCP/IP Stack\n\nThe practical model used on the Internet:\n\n- **Link** (≈ OSI 1+2)\n- **Internet** (≈ OSI 3) — IP, ICMP\n- **Transport** (≈ OSI 4) — TCP, UDP\n- **Application** (≈ OSI 5–7) — HTTP, DNS, SSH\n\n**TCP** is reliable, ordered, connection-oriented.\n**UDP** is fast, unreliable, connectionless.` },
      { id: 'ipaddr', title: 'IP Addressing', readMinutes: 4,
        body: `# IP Addressing\n\nIPv4 addresses are 32-bit, written as four octets: \`192.168.1.10\`.\n\n## Classes (historical)\n- A: 1.0.0.0 – 126.0.0.0\n- B: 128.0.0.0 – 191.255.0.0\n- C: 192.0.0.0 – 223.255.255.0\n\n## Private ranges (RFC 1918)\n- 10.0.0.0/8\n- 172.16.0.0/12\n- 192.168.0.0/16` },
      { id: 'subnetting', title: 'Subnetting', readMinutes: 6,
        diagram: SUBNET_DIAGRAM,
        body: `# Subnetting\n\nA **subnet mask** splits an IP into network and host parts.\n\n\`\`\`\n192.168.1.0/24 → 192.168.1.0 – 192.168.1.255\n  - Network: 192.168.1.0\n  - Broadcast: 192.168.1.255\n  - Usable: 192.168.1.1 – 192.168.1.254\n\`\`\`\n\n**/30** = 4 addresses, 2 usable — perfect for point-to-point links.` },
      { id: 'arp', title: 'ARP & MAC', readMinutes: 3,
        diagram: ARP_DIAGRAM,
        body: `# ARP\n\nThe **Address Resolution Protocol** maps an IP address to a MAC address on a local segment.\n\n1. Host broadcasts: "Who has 192.168.1.1?"\n2. Owner replies with its MAC.\n3. Sender caches the mapping in its ARP table.\n\nView with: \`arp -a\` (Windows/Linux) or \`show ip arp\` (Cisco).` },
    ],
    quiz: [
      { id: 'q1', question: 'Which OSI layer does a router primarily operate at?', options: ['Layer 2', 'Layer 3', 'Layer 4', 'Layer 7'], answer: 1 },
      { id: 'q2', question: 'What is the broadcast address of 192.168.1.0/24?', options: ['192.168.1.0', '192.168.1.1', '192.168.1.254', '192.168.1.255'], answer: 3 },
      { id: 'q3', question: 'TCP is...', options: ['Connectionless', 'Unreliable', 'Reliable & ordered', 'Layer 2'], answer: 2 },
    ],
  },
  {
    id: 'routing-switching',
    title: 'Routing & Switching',
    description: 'Static routes, OSPF, RIP, VLANs, and inter-VLAN routing.',
    difficulty: 'intermediate',
    icon: '🔀',
    topics: ['Static Routing', 'OSPF', 'VLANs', 'Trunking'],
    lessons: [
      { id: 'static', title: 'Static Routing', body: `# Static Routing\n\nManually configure a path:\n\n\`\`\`\nip route 10.0.2.0 255.255.255.0 10.0.1.2\n\`\`\`\n\nUse when topology is small and stable.` },
      { id: 'ospf', title: 'OSPF Basics', diagram: OSPF_DIAGRAM, readMinutes: 6, body: `# OSPF\n\n**Open Shortest Path First** is a link-state IGP. Routers exchange LSAs and run **Dijkstra** to compute the shortest path.\n\n\`\`\`\nrouter ospf 1\n network 10.0.0.0 0.0.0.255 area 0\n\`\`\`\n\n## Neighbor states\nDown → Init → 2-Way → ExStart → Exchange → Loading → **Full**` },
      { id: 'vlans', title: 'VLANs', diagram: VLAN_DIAGRAM, readMinutes: 5, body: `# VLANs\n\nA **VLAN** segments a switch into multiple broadcast domains.\n\n\`\`\`\nvlan 10\n name SALES\ninterface FastEthernet0/1\n switchport mode access\n switchport access vlan 10\n\`\`\`` },
      { id: 'trunk', title: 'Trunking (802.1Q)', body: `# 802.1Q Trunking\n\nA **trunk port** carries traffic for multiple VLANs by tagging each frame.\n\n\`\`\`\ninterface GigabitEthernet0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30\n\`\`\`` },
    ],
    quiz: [
      { id: 'q1', question: 'OSPF uses which algorithm?', options: ['Bellman-Ford', 'Dijkstra', 'DUAL', 'Path-Vector'], answer: 1 },
      { id: 'q2', question: 'Which command creates VLAN 20?', options: ['vlan 20', 'switchport vlan 20', 'create vlan 20', 'set vlan 20'], answer: 0 },
    ],
  },
  {
    id: 'security-firewall',
    title: 'Security & Firewall',
    description: 'ACLs, NAT, firewall zones, and basic hardening.',
    difficulty: 'intermediate',
    icon: '🛡️',
    topics: ['ACLs', 'NAT', 'Firewall Rules', 'Hardening'],
    lessons: [
      { id: 'acls', title: 'Access Control Lists', body: `# ACLs\n\nFilter traffic based on source, destination, protocol, port.\n\n\`\`\`\nip access-list extended BLOCK_TELNET\n deny tcp any any eq 23\n permit ip any any\n\`\`\`` },
      { id: 'nat', title: 'NAT & PAT', diagram: NAT_DIAGRAM, readMinutes: 4, body: `# NAT\n\n**NAT** translates private IPs to public IPs. **PAT** (overload) shares one public IP across many internal hosts using ports.\n\n\`\`\`\nip nat inside source list 1 interface gi0/1 overload\n\`\`\`` },
      { id: 'harden', title: 'Device Hardening', body: `# Hardening\n\n- \`service password-encryption\`\n- \`enable secret <strong>\`\n- \`no ip http server\`\n- \`no cdp run\` on untrusted ports\n- Restrict VTY: \`access-class\` + \`transport input ssh\`` },
    ],
    quiz: [
      { id: 'q1', question: 'PAT overloads on what?', options: ['MAC', 'IP only', 'Port', 'VLAN'], answer: 2 },
    ],
  },
  {
    id: 'wireless',
    title: 'Wireless Networking',
    description: 'WiFi standards, SSID, WPA2/WPA3, and AP configuration.',
    difficulty: 'intermediate',
    icon: '📶',
    topics: ['802.11', 'SSID', 'WPA2/WPA3', 'Channels'],
    lessons: [
      { id: '802-11', title: '802.11 Standards', body: `# 802.11 Family\n\n- **a/g**: legacy, 54 Mbps\n- **n**: up to 600 Mbps, MIMO\n- **ac (Wi-Fi 5)**: 1+ Gbps, 5 GHz\n- **ax (Wi-Fi 6)**: 9.6 Gbps, OFDMA\n- **be (Wi-Fi 7)**: multi-link operation` },
      { id: 'security', title: 'WiFi Security', diagram: WIFI_DIAGRAM, readMinutes: 4, body: `# WiFi Security\n\n- WEP: broken, never use\n- WPA: deprecated\n- **WPA2-PSK**: AES, still common\n- **WPA3**: SAE handshake, forward secrecy` },
    ],
    quiz: [
      { id: 'q1', question: 'WPA3 uses which handshake?', options: ['4-way', 'TKIP', 'SAE', 'EAP-TLS'], answer: 2 },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Methodology, ping, traceroute, and reading routing tables.',
    difficulty: 'intermediate',
    icon: '🔧',
    topics: ['Ping', 'Traceroute', 'show commands', 'Methodology'],
    lessons: [
      { id: 'method', title: 'Methodology', body: `# Top-Down vs Bottom-Up\n\n- **Bottom-up**: start at Layer 1 (cable, link lights) and work up.\n- **Top-down**: start at the app and work down.\n- **Divide & conquer**: ping a midpoint to isolate.` },
      { id: 'ping', title: 'Ping', diagram: PING_DIAGRAM, readMinutes: 3, body: `# Ping\n\nSends **ICMP echo requests**. Reply means full L3 reachability + return path.\n\n- "Request timed out" → no reply (could be firewall)\n- "Destination unreachable" → router has no route` },
      { id: 'trace', title: 'Traceroute', body: `# Traceroute\n\nIncrements TTL each hop to discover the path. Each hop returns **ICMP TTL exceeded**.` },
    ],
    quiz: [
      { id: 'q1', question: 'Traceroute relies on...', options: ['ARP', 'DNS', 'TTL expiry', 'TCP SYN'], answer: 2 },
    ],
  },
  {
    id: 'ccna-prep',
    title: 'CCNA Prep',
    description: 'Exam-focused review covering all CCNA topics.',
    difficulty: 'advanced',
    icon: '🎯',
    topics: ['IPv4/IPv6', 'OSPFv2', 'EtherChannel', 'STP', 'NAT', 'Wireless', 'Security', 'Automation'],
    lessons: [
      { id: 'ipv6', title: 'IPv6 Essentials', body: `# IPv6\n\n128-bit addresses. Compress runs of zeros with \`::\` once.\n\n\`\`\`\n2001:0db8:0000:0000:0000:0000:0000:0001\n→ 2001:db8::1\n\`\`\`\n\n**Link-local**: fe80::/10` },
      { id: 'stp', title: 'Spanning Tree', diagram: STP_DIAGRAM, readMinutes: 5, body: `# Spanning Tree Protocol\n\nPrevents loops in switched networks. Elects a **root bridge** (lowest priority/MAC), each non-root selects a **root port** and blocks redundant links.` },
      { id: 'etherchannel', title: 'EtherChannel', body: `# EtherChannel\n\nBundles multiple physical links into one logical link. Protocols: **LACP** (standard), **PAgP** (Cisco).` },
      { id: 'review', title: 'Exam Tips', body: `# Exam Tips\n\n- Know the IPv4 header fields\n- Memorize port numbers: 20/21 FTP, 22 SSH, 23 Telnet, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS\n- Practice subnetting until under 30 sec/question\n- Lab everything in NetSem` },
    ],
    quiz: [
      { id: 'q1', question: 'IPv6 link-local prefix?', options: ['2001::/16', 'fe80::/10', 'fc00::/7', 'ff00::/8'], answer: 1 },
      { id: 'q2', question: 'LACP is standard for...', options: ['Routing', 'EtherChannel', 'STP', 'VLAN'], answer: 1 },
      { id: 'q3', question: 'HTTPS port?', options: ['80', '8080', '443', '8443'], answer: 2 },
    ],
  },
];

export function getCourse(id: string): CourseDef | undefined {
  return COURSES.find(c => c.id === id);
}