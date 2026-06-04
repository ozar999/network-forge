import type { Device } from '../types';
import { getRouterCompletions } from './routerCommands';

// Explicit multi-word Cisco shortcuts (case-insensitive, applied first).
const EXPLICIT_ALIASES: Array<[RegExp, string]> = [
  [/^conf\s+t(?:\s|$)/i, 'configure terminal '],
  [/^sh\s+run(?:\s|$)/i, 'show running-config '],
  [/^sh\s+start(?:\s|$)/i, 'show startup-config '],
  [/^sh\s+ip\s+int\s+br(?:\s|$)/i, 'show ip interface brief '],
  [/^sh\s+ip\s+int(?:\s|$)/i, 'show ip interface '],
  [/^sh\s+ip\s+ro(?:ute)?(?:\s|$)/i, 'show ip route '],
  [/^sh\s+int\s+br(?:ief)?(?:\s|$)/i, 'show interfaces brief '],
  [/^sh\s+int(?:erfaces)?(?:\s|$)/i, 'show interfaces '],
  [/^sh\s+ver(?:sion)?(?:\s|$)/i, 'show version '],
  [/^sh\s+vlan(?:\s|$)/i, 'show vlan '],
  [/^sh\s+arp(?:\s|$)/i, 'show arp '],
  [/^sh\s+mac(?:\s|$)/i, 'show mac-address-table '],
  [/^sh\s+cdp\s+nei(?:ghbors)?(?:\s|$)/i, 'show cdp neighbors '],
  [/^sh\s+ip\s+dhcp\s+bind(?:ing)?(?:\s|$)/i, 'show ip dhcp binding '],
  [/^sh\s+ip\s+dhcp\s+pool(?:\s|$)/i, 'show ip dhcp pool '],
  [/^sh\s+ip\s+proto(?:cols)?(?:\s|$)/i, 'show ip protocols '],
  [/^sh\s+ip\s+nat(?:\s|$)/i, 'show ip nat translations '],
  [/^sh\s+access(?:-lists)?(?:\s|$)/i, 'show access-lists '],
  [/^no\s+shut(?:\s|$)/i, 'no shutdown '],
  [/^en(?:\s|$)/i, 'enable '],
  [/^dis(?:\s|$)/i, 'disable '],
  [/^wr(?:\s|$)/i, 'write memory '],
  [/^copy\s+run\s+start(?:\s|$)/i, 'copy running-config startup-config '],
  [/^copy\s+run\s+tftp(?:\s|$)/i, 'copy running-config tftp '],
  [/^undeb\s+all(?:\s|$)/i, 'undebug all '],
];

function applyExplicitAliases(input: string): string {
  let out = input;
  for (const [re, repl] of EXPLICIT_ALIASES) {
    if (re.test(out)) {
      out = out.replace(re, repl);
      break;
    }
  }
  return out;
}

function uniquePrefixMatch(token: string, candidates: string[]): string | null {
  if (!token) return null;
  const lower = token.toLowerCase();
  const exact = candidates.find(c => c.toLowerCase() === lower);
  if (exact) return exact;
  const matches = candidates.filter(c => c.toLowerCase().startsWith(lower));
  if (matches.length === 1) return matches[0];
  return null;
}

/**
 * Expand Cisco-style abbreviations to full commands.
 * Walks tokens left-to-right, resolving each as a unique prefix in the
 * completion tree for the current mode.
 */
export function expandCiscoCommand(input: string, device: Device, mode: string): string {
  if (!input.trim()) return input;
  // Only expand for Cisco-style devices.
  if (device.type === 'pc' || device.type === 'laptop' || device.type === 'server' || device.type === 'accesspoint') {
    return input;
  }
  const aliased = applyExplicitAliases(input);
  const tree = getRouterCompletions(mode, device);
  const trailingSpace = /\s$/.test(aliased);
  const tokens = aliased.trim().split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const prefix = out.join(' ');
    const candidates = tree[prefix] ?? tree[''] ?? [];
    const expanded = uniquePrefixMatch(tokens[i], candidates);
    out.push(expanded ?? tokens[i]);
  }
  return out.join(' ') + (trailingSpace ? ' ' : '');
}

/**
 * Suggestions for the current partial token, up to `limit` entries.
 */
export function getSuggestions(input: string, device: Device, mode: string, limit = 6): string[] {
  if (device.type === 'accesspoint') return [];
  const tree =
    device.type === 'pc' || device.type === 'laptop'
      ? {
          '': ['ipconfig', 'ping', 'tracert', 'arp', 'nslookup', 'netstat', 'route', 'help', 'clear'],
          ipconfig: ['/all', '/release', '/renew'],
          route: ['print'],
        } as Record<string, string[]>
      : device.type === 'server'
      ? {
          '': ['ifconfig', 'ip', 'ping', 'traceroute', 'netstat', 'service', 'systemctl', 'help', 'clear'],
          ip: ['addr', 'route'],
          service: ['dhcpd', 'named', 'vsftpd', 'apache2', 'tftpd', 'rsyslog'],
        } as Record<string, string[]>
      : getRouterCompletions(mode, device);

  const trailingSpace = /\s$/.test(input);
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  let prefix: string;
  let partial: string;
  if (trailingSpace || tokens.length === 0) {
    prefix = tokens.join(' ');
    partial = '';
  } else {
    prefix = tokens.slice(0, -1).join(' ');
    partial = tokens[tokens.length - 1];
  }
  const candidates = tree[prefix] ?? (prefix === '' ? tree[''] ?? [] : []);
  const lower = partial.toLowerCase();
  const matches = candidates.filter(c => c.toLowerCase().startsWith(lower));
  return matches.slice(0, limit);
}