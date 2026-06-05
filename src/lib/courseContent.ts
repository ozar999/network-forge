export interface Lesson {
  id: string;
  title: string;
  body: string; // markdown-ish
  diagram?: string; // inline SVG markup — concept architecture for this lesson
  readMinutes?: number;
}

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
      { id: 'ospf', title: 'OSPF Basics', body: `# OSPF\n\n**Open Shortest Path First** is a link-state IGP. Routers exchange LSAs and run **Dijkstra** to compute the shortest path.\n\n\`\`\`\nrouter ospf 1\n network 10.0.0.0 0.0.0.255 area 0\n\`\`\`\n\n## Neighbor states\nDown → Init → 2-Way → ExStart → Exchange → Loading → **Full**` },
      { id: 'vlans', title: 'VLANs', body: `# VLANs\n\nA **VLAN** segments a switch into multiple broadcast domains.\n\n\`\`\`\nvlan 10\n name SALES\ninterface FastEthernet0/1\n switchport mode access\n switchport access vlan 10\n\`\`\`` },
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
      { id: 'nat', title: 'NAT & PAT', body: `# NAT\n\n**NAT** translates private IPs to public IPs. **PAT** (overload) shares one public IP across many internal hosts using ports.\n\n\`\`\`\nip nat inside source list 1 interface gi0/1 overload\n\`\`\`` },
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
      { id: 'security', title: 'WiFi Security', body: `# WiFi Security\n\n- WEP: broken, never use\n- WPA: deprecated\n- **WPA2-PSK**: AES, still common\n- **WPA3**: SAE handshake, forward secrecy` },
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
      { id: 'ping', title: 'Ping', body: `# Ping\n\nSends **ICMP echo requests**. Reply means full L3 reachability + return path.\n\n- "Request timed out" → no reply (could be firewall)\n- "Destination unreachable" → router has no route` },
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
      { id: 'stp', title: 'Spanning Tree', body: `# Spanning Tree Protocol\n\nPrevents loops in switched networks. Elects a **root bridge** (lowest priority/MAC), each non-root selects a **root port** and blocks redundant links.` },
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