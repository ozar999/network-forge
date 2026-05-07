export type DeviceType = 'router' | 'switch' | 'pc' | 'laptop' | 'server' | 'firewall' | 'accesspoint';

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  x: number;
  y: number;
  status: 'up' | 'down';
  interfaces: NetworkInterface[];
  config: string[];
  hostname: string;
  enableSecret?: string;
  banner?: string;
  routingTable: RouteEntry[];
  arpTable: ArpEntry[];
  macTable: MacEntry[];
  dhcpPools: DhcpPool[];
  services: DeviceService[];
  vlanTable: VlanEntry[];
  // PC/Laptop specific
  defaultGateway?: string;
  dnsServer?: string;
  dhcpEnabled?: boolean;
  // AP specific
  ssid?: string;
  wpaPassword?: string;
  channel?: number;
  apMode?: 'ap' | 'repeater';
  // Firewall specific
  nameifs?: Record<string, { name: string; securityLevel: number }>;
  objectNetworks?: { name: string; subnet?: string; mask?: string; natRule?: string }[];
  accessLists?: { name: string; rules: AclRule[] }[];
  natRules?: NatRule[];
  // Routing protocol state
  ospfConfig?: { processId: number; networks: { network: string; wildcard: string; area: number }[]; routerId?: string };
  ripConfig?: { version: number; networks: string[]; autoSummary: boolean };
  eigrpConfig?: { as: number; networks: string[] };
  bgpConfig?: { as: number; neighbors: { ip: string; remoteAs: number }[]; networks: { network: string; mask: string }[] };
  // Security
  passwordEncryption?: boolean;
  aclGroups?: Record<string, { aclName: string; direction: 'in' | 'out' }>;
  // DNS records (server)
  dnsRecords?: DnsRecord[];
  // Syslog entries
  syslogEntries?: SyslogEntry[];
  // HTTP page content
  httpPageTitle?: string;
  httpPageContent?: string;
  // FTP
  ftpUsername?: string;
  ftpPassword?: string;
  // AP additional
  frequency?: '2.4GHz' | '5GHz';
  broadcastSsid?: boolean;
  maxClients?: number;
  apAdminPassword?: string;
  macFilterEnabled?: boolean;
  macFilterList?: string[];
  apFirewall?: boolean;
  apDhcpEnabled?: boolean;
  apDhcpPoolStart?: string;
  apDhcpPoolEnd?: string;
  apDhcpLeaseTime?: number;
  apDhcpDns?: string;
  apLanIp?: string;
  apLanMask?: string;
}

export interface AclRule {
  action: 'permit' | 'deny';
  protocol: string;
  source: string;
  sourceWildcard?: string;
  destination: string;
  destWildcard?: string;
}

export interface NatRule {
  type: 'inside' | 'outside';
  accessList?: string;
  interface?: string;
  overload?: boolean;
}

export interface DnsRecord {
  type: 'A' | 'CNAME';
  hostname: string;
  value: string;
}

export interface SyslogEntry {
  timestamp: number;
  device: string;
  severity: string;
  message: string;
}

export interface NetworkInterface {
  name: string;
  ip?: string;
  mask?: string;
  connected: boolean;
  connectedTo?: string;
  connectedInterface?: string;
  connectionId?: string;
  status: 'up' | 'down';
  macAddress: string;
  speed?: string;
  duplex?: string;
  vlan?: number;
  switchportMode?: 'access' | 'trunk';
  description?: string;
  isWireless?: boolean;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromInterface: string;
  toInterface: string;
  type: 'wired' | 'wireless';
}

export interface Packet {
  id: string;
  sourceIp: string;
  destIp: string;
  ttl: number;
  protocol: string;
  progress: number;
  connectionId: string;
  direction: 'forward' | 'reverse';
}

export interface RouteEntry {
  network: string;
  mask: string;
  nextHop?: string;
  interface?: string;
  type: 'C' | 'S' | 'O' | 'R' | 'D' | 'B';
  metric?: number;
  ad?: number;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  interface: string;
  age: number;
}

export interface MacEntry {
  mac: string;
  vlan: number;
  interface: string;
  type: 'dynamic' | 'static';
}

export interface DhcpPool {
  name: string;
  network: string;
  mask: string;
  defaultRouter?: string;
  dnsServer?: string;
  leaseTime?: number;
  excludedAddresses: string[];
  leases: DhcpLease[];
}

export interface DhcpLease {
  ip: string;
  mac: string;
  hostname?: string;
  expiry: number;
}

export interface VlanEntry {
  id: number;
  name: string;
  status: 'active' | 'suspended';
}

export interface DeviceService {
  type: 'dhcp' | 'dns' | 'http' | 'ftp' | 'tftp' | 'syslog';
  enabled: boolean;
  port: number;
}

export interface LabScenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  devices: Device[];
  connections: Connection[];
  objectives: string[];
}

export const DEVICE_DEFAULTS: Record<DeviceType, { interfaces: string[]; icon: string; defaultServices?: DeviceService[] }> = {
  router: {
    interfaces: ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'GigabitEthernet0/3'],
    icon: 'router',
  },
  switch: {
    interfaces: [
      'FastEthernet0/1', 'FastEthernet0/2', 'FastEthernet0/3', 'FastEthernet0/4',
      'FastEthernet0/5', 'FastEthernet0/6', 'FastEthernet0/7', 'FastEthernet0/8',
      'FastEthernet0/9', 'FastEthernet0/10', 'FastEthernet0/11', 'FastEthernet0/12',
      'FastEthernet0/13', 'FastEthernet0/14', 'FastEthernet0/15', 'FastEthernet0/16',
      'FastEthernet0/17', 'FastEthernet0/18', 'FastEthernet0/19', 'FastEthernet0/20',
      'FastEthernet0/21', 'FastEthernet0/22', 'FastEthernet0/23', 'FastEthernet0/24',
      'GigabitEthernet0/1', 'GigabitEthernet0/2',
    ],
    icon: 'switch',
  },
  pc: { interfaces: ['Ethernet0'], icon: 'pc' },
  laptop: { interfaces: ['Ethernet0', 'Wireless0'], icon: 'laptop' },
  server: {
    interfaces: ['Ethernet0'],
    icon: 'server',
    defaultServices: [
      { type: 'dhcp', enabled: false, port: 67 },
      { type: 'dns', enabled: false, port: 53 },
      { type: 'http', enabled: false, port: 80 },
      { type: 'ftp', enabled: false, port: 21 },
      { type: 'tftp', enabled: false, port: 69 },
      { type: 'syslog', enabled: false, port: 514 },
    ],
  },
  firewall: {
    interfaces: ['GigabitEthernet1/1', 'GigabitEthernet1/2'],
    icon: 'firewall',
  },
  accesspoint: {
    interfaces: ['Ethernet0'],
    icon: 'accesspoint',
  },
};

// Utility functions
export function generateMac(): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return `aa${hex()}.${hex()}${hex()}.${hex()}${hex()}`;
}

export function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

export function intToIp(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

export function intToIpStr(n: number): string {
  return intToIp(n).join('.');
}

export function maskToCidr(mask: string): number {
  const n = ipToInt(mask);
  let bits = 0;
  let m = n;
  while (m & 0x80000000) {
    bits++;
    m <<= 1;
  }
  return bits;
}

export function cidrToMask(cidr: number): string {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return intToIpStr(mask);
}

export function getNetworkAddress(ip: string, mask: string): string {
  return intToIpStr((ipToInt(ip) & ipToInt(mask)) >>> 0);
}

export function isInSameSubnet(ip1: string, ip2: string, mask: string): boolean {
  return getNetworkAddress(ip1, mask) === getNetworkAddress(ip2, mask);
}

export interface SavedLab {
  id: string;
  name: string;
  timestamp: number;
  devices: Device[];
  connections: Connection[];
}