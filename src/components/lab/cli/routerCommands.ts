import type { Device, RouteEntry, AclRule, NetworkInterface } from '../types';
import { generateConnectedRoutes, simulatePing, simulateTraceroute, simulateDhcp } from '../networkEngine';
import type { Connection } from '../types';
import type { PingResult } from '../PingResultPopup';

export interface CliContext {
  device: Device;
  mode: string;
  currentInterface: string;
  currentSubmode: string;
  currentDhcpPool: string;
  currentAcl: string;
  allDevices: Device[];
  connections: Connection[];
  onUpdateDevice?: (device: Device) => void;
  onPingResult?: (result: PingResult) => void;
  setMode: (mode: string) => void;
  setCurrentInterface: (iface: string) => void;
  setCurrentSubmode: (sub: string) => void;
  setCurrentDhcpPool: (pool: string) => void;
  setCurrentAcl: (acl: string) => void;
}

export function processRouterCommand(cmd: string, ctx: CliContext): string {
  const trimmed = cmd.trim().toLowerCase();
  const originalCmd = cmd.trim();
  const parts = originalCmd.split(/\s+/);
  const { device, mode, allDevices, connections, onUpdateDevice, onPingResult } = ctx;

  // Help
  if (trimmed === '?' || trimmed === 'help') {
    return getHelpForMode(mode);
  }

  // Clear
  if (trimmed === 'clear') return '__CLEAR__';

  // Empty
  if (trimmed === '') return '';

  // Exit / end
  if (trimmed === 'end') {
    ctx.setMode('privileged');
    return '';
  }
  if (trimmed === 'exit' || trimmed === 'logout') {
    if (mode === 'config-if') ctx.setMode('config');
    else if (mode === 'config-router' || mode === 'dhcp-config' || mode === 'config-line' || mode === 'config-vlan') ctx.setMode('config');
    else if (mode === 'config') ctx.setMode('privileged');
    else if (mode === 'privileged') ctx.setMode('user');
    else return '';
    return '';
  }

  // === USER MODE ===
  if (mode === 'user') {
    if (trimmed === 'enable') { ctx.setMode('privileged'); return ''; }
    if (trimmed.startsWith('ping ')) return handlePing(parts[1], ctx);
    if (trimmed.startsWith('traceroute ')) return simulateTraceroute(device, parts[1], allDevices, connections);
    if (trimmed === 'show version') return showVersion(device);
    return `% Invalid input detected at '^' marker.\n% Type "enable" to enter privileged mode.`;
  }

  // === PRIVILEGED MODE ===
  if (mode === 'privileged') {
    if (trimmed === 'configure terminal' || trimmed === 'conf t') { ctx.setMode('config'); return 'Enter configuration commands, one per line. End with CNTL/Z.'; }
    if (trimmed.startsWith('ping ')) return handlePing(parts[1], ctx);
    if (trimmed.startsWith('traceroute ')) return simulateTraceroute(device, parts[1], allDevices, connections);
    if (trimmed.startsWith('show ')) return handleShow(trimmed, device, allDevices, connections);
    if (trimmed === 'copy running-config startup-config' || trimmed === 'copy run start' || trimmed === 'wr' || trimmed === 'write' || trimmed === 'write memory') return 'Building configuration...\n[OK]';
    if (trimmed === 'copy running-config tftp' || trimmed === 'copy run tftp') return 'Address or name of remote host []? \n% Transfer complete.';
    if (trimmed.startsWith('debug ip icmp')) return 'ICMP packet debugging is on';
    if (trimmed === 'no debug all' || trimmed === 'undebug all') return 'All possible debugging has been turned off';
    if (trimmed.startsWith('clock set ')) return '';
    if (trimmed === 'terminal monitor') return '';
    return `% Unknown command or invalid input: "${parts[0]}"`;
  }

  // === GLOBAL CONFIG ===
  if (mode === 'config') {
    if (trimmed.startsWith('hostname ')) {
      const h = originalCmd.substring(9).trim();
      if (onUpdateDevice) onUpdateDevice({ ...device, hostname: h, name: h });
      return '';
    }
    if (trimmed.startsWith('interface ')) {
      const ifName = originalCmd.substring(10).trim();
      const iface = device.interfaces.find(i => i.name.toLowerCase() === ifName.toLowerCase() || i.name.toLowerCase().startsWith(ifName.toLowerCase()));
      if (iface) { ctx.setCurrentInterface(iface.name); ctx.setMode('config-if'); return ''; }
      return `% Invalid interface: ${ifName}`;
    }
    if (trimmed.startsWith('ip route ')) {
      const rp = parts;
      if (rp.length >= 5 && onUpdateDevice) {
        onUpdateDevice({ ...device, routingTable: [...device.routingTable, { network: rp[2], mask: rp[3], nextHop: rp[4], type: 'S' }] });
        return '';
      }
      return '% Incomplete command. Usage: ip route <network> <mask> <next-hop>';
    }
    if (trimmed.startsWith('no ip route ')) {
      const rp = parts;
      if (rp.length >= 6 && onUpdateDevice) {
        onUpdateDevice({ ...device, routingTable: device.routingTable.filter(r => !(r.network === rp[3] && r.mask === rp[4] && r.nextHop === rp[5])) });
        return '';
      }
      return '';
    }
    if (trimmed.startsWith('router ospf ')) {
      const pid = parseInt(parts[2]);
      if (onUpdateDevice) onUpdateDevice({ ...device, ospfConfig: device.ospfConfig || { processId: pid, networks: [] } });
      ctx.setMode('config-router');
      ctx.setCurrentSubmode('ospf');
      return '';
    }
    if (trimmed === 'router rip') {
      if (onUpdateDevice) onUpdateDevice({ ...device, ripConfig: device.ripConfig || { version: 1, networks: [], autoSummary: true } });
      ctx.setMode('config-router');
      ctx.setCurrentSubmode('rip');
      return '';
    }
    if (trimmed.startsWith('router eigrp ')) {
      const as = parseInt(parts[2]);
      if (onUpdateDevice) onUpdateDevice({ ...device, eigrpConfig: device.eigrpConfig || { as, networks: [] } });
      ctx.setMode('config-router');
      ctx.setCurrentSubmode('eigrp');
      return '';
    }
    if (trimmed.startsWith('router bgp ')) {
      const as = parseInt(parts[2]);
      if (onUpdateDevice) onUpdateDevice({ ...device, bgpConfig: device.bgpConfig || { as, neighbors: [], networks: [] } });
      ctx.setMode('config-router');
      ctx.setCurrentSubmode('bgp');
      return '';
    }
    if (trimmed.startsWith('ip dhcp pool ')) {
      const poolName = originalCmd.substring(13).trim();
      if (onUpdateDevice) {
        const existing = device.dhcpPools.find(p => p.name === poolName);
        if (!existing) {
          onUpdateDevice({ ...device, dhcpPools: [...device.dhcpPools, { name: poolName, network: '', mask: '', excludedAddresses: [], leases: [] }] });
        }
      }
      ctx.setCurrentDhcpPool(poolName);
      ctx.setMode('dhcp-config');
      return '';
    }
    if (trimmed.startsWith('no ip dhcp pool ')) {
      const poolName = originalCmd.substring(16).trim();
      if (onUpdateDevice) onUpdateDevice({ ...device, dhcpPools: device.dhcpPools.filter(p => p.name !== poolName) });
      return '';
    }
    if (trimmed.startsWith('ip dhcp excluded-address ')) {
      const ep = parts;
      if (ep.length >= 4 && onUpdateDevice) {
        const start = ep[3];
        const end = ep[4] || start;
        // Add to all pools (simplified)
        const pools = device.dhcpPools.map(p => ({ ...p, excludedAddresses: [...p.excludedAddresses, start] }));
        onUpdateDevice({ ...device, dhcpPools: pools });
        return '';
      }
    }
    if (trimmed.startsWith('ip access-list extended ')) {
      const aclName = originalCmd.substring(23).trim();
      if (onUpdateDevice) {
        const existing = (device.accessLists || []).find(a => a.name === aclName);
        if (!existing) {
          onUpdateDevice({ ...device, accessLists: [...(device.accessLists || []), { name: aclName, rules: [] }] });
        }
      }
      ctx.setCurrentAcl(aclName);
      ctx.setMode('config'); // stay in config with acl context
      return '';
    }
    if (trimmed.startsWith('access-list ')) {
      // Standard numbered ACL
      return '';
    }
    if (trimmed.startsWith('ip nat pool ')) return '';
    if (trimmed.startsWith('ip nat inside source ')) {
      if (onUpdateDevice) {
        onUpdateDevice({ ...device, natRules: [...(device.natRules || []), { type: 'inside', overload: trimmed.includes('overload') }] });
      }
      return '';
    }
    if (trimmed.startsWith('banner motd ')) {
      const bannerText = originalCmd.substring(12).replace(/^#|#$/g, '').trim();
      if (onUpdateDevice) onUpdateDevice({ ...device, banner: bannerText });
      return '';
    }
    if (trimmed.startsWith('enable secret ')) {
      const secret = originalCmd.substring(14).trim();
      if (onUpdateDevice) onUpdateDevice({ ...device, enableSecret: secret });
      return '';
    }
    if (trimmed === 'service password-encryption') {
      if (onUpdateDevice) onUpdateDevice({ ...device, passwordEncryption: true });
      return '';
    }
    if (trimmed === 'no ip domain-lookup') return '';
    if (trimmed.startsWith('ip name-server ')) return '';
    if (trimmed.startsWith('ip domain-name ')) return '';
    if (trimmed === 'line vty 0 4' || trimmed === 'line vty 0 15') { ctx.setMode('config-line'); return ''; }
    if (trimmed === 'line console 0') { ctx.setMode('config-line'); return ''; }
    if (trimmed.startsWith('vlan ')) {
      if (device.type === 'switch') {
        const vlanId = parseInt(parts[1]);
        if (!isNaN(vlanId) && onUpdateDevice) {
          const existing = (device.vlanTable || []).find(v => v.id === vlanId);
          if (!existing) {
            onUpdateDevice({ ...device, vlanTable: [...(device.vlanTable || []), { id: vlanId, name: `VLAN${vlanId}`, status: 'active' }] });
          }
          ctx.setMode('config-vlan');
        }
        return '';
      }
    }
    if (trimmed.startsWith('logging ')) return '';
    if (trimmed.startsWith('ntp server ')) return '';
    if (trimmed.startsWith('snmp-server ')) return '';
    if (trimmed.startsWith('spanning-tree ')) return '';
    if (trimmed === 'no cdp run') return '';
    if (trimmed === 'no ip http server') return '';
    return `% Unknown command: "${parts[0]}"`;
  }

  // === CONFIG-IF ===
  if (mode === 'config-if') {
    if (trimmed.startsWith('ip address ')) {
      const ip = parts[2];
      const mask = parts[3];
      if (ip && mask && onUpdateDevice) {
        onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, ip, mask } : i) });
        return '';
      }
      return '% Incomplete command. Usage: ip address <ip> <mask>';
    }
    if (trimmed === 'ip address dhcp') {
      // DHCP client on this interface
      const result = simulateDhcp(device, ctx.currentInterface, allDevices, connections);
      if (result.success && onUpdateDevice) {
        onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, ip: result.ip, mask: result.mask } : i), defaultGateway: result.gateway, dnsServer: result.dns });
        return `DHCP: Assigned ${result.ip} from pool ${result.poolName} on ${result.serverName}`;
      }
      return '% DHCP: No server found or no available addresses.';
    }
    if (trimmed === 'no ip address') {
      if (onUpdateDevice) onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, ip: undefined, mask: undefined } : i) });
      return '';
    }
    if (trimmed === 'no shutdown') {
      if (onUpdateDevice) onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, status: 'up' } : i) });
      return '%LINK-3-UPDOWN: Interface changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol changed state to up';
    }
    if (trimmed === 'shutdown') {
      if (onUpdateDevice) onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, status: 'down' } : i) });
      return '%LINK-3-UPDOWN: Interface changed state to down\n%LINEPROTO-5-UPDOWN: Line protocol changed state to down';
    }
    if (trimmed.startsWith('description ')) {
      const desc = originalCmd.substring(12);
      if (onUpdateDevice) onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, description: desc } : i) });
      return '';
    }
    if (trimmed.startsWith('duplex ')) return '';
    if (trimmed.startsWith('speed ')) return '';
    if (trimmed === 'ip nat inside') {
      if (onUpdateDevice) onUpdateDevice({ ...device, natRules: [...(device.natRules || []), { type: 'inside', interface: ctx.currentInterface }] });
      return '';
    }
    if (trimmed === 'ip nat outside') {
      if (onUpdateDevice) onUpdateDevice({ ...device, natRules: [...(device.natRules || []), { type: 'outside', interface: ctx.currentInterface }] });
      return '';
    }
    if (trimmed.startsWith('ip access-group ')) return '';
    if (trimmed.startsWith('ip helper-address ')) return '';
    if (trimmed.startsWith('switchport mode ')) {
      const swMode = parts[2] as 'access' | 'trunk';
      if (onUpdateDevice) onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, switchportMode: swMode } : i) });
      return '';
    }
    if (trimmed.startsWith('switchport access vlan ')) {
      const vlanId = parseInt(parts[3]);
      if (onUpdateDevice) onUpdateDevice({ ...device, interfaces: device.interfaces.map(i => i.name === ctx.currentInterface ? { ...i, vlan: vlanId } : i) });
      return '';
    }
    if (trimmed.startsWith('switchport trunk allowed vlan ')) return '';
    if (trimmed.startsWith('switchport trunk native vlan ')) return '';
    if (trimmed === 'spanning-tree portfast') return '';
    if (trimmed.startsWith('encapsulation dot1q ')) return '';
    return `% Unknown interface command: "${parts[0]}"`;
  }

  // === CONFIG-ROUTER ===
  if (mode === 'config-router') {
    if (trimmed.startsWith('network ')) {
      const net = parts[1];
      const wildcard = parts[2] || '0.0.0.255';
      const area = parts[4] !== undefined ? parseInt(parts[4]) : 0;
      if (ctx.currentSubmode === 'ospf' && onUpdateDevice) {
        const ospf = device.ospfConfig || { processId: 1, networks: [] };
        onUpdateDevice({ ...device, ospfConfig: { ...ospf, networks: [...ospf.networks, { network: net, wildcard, area }] } });
      } else if (ctx.currentSubmode === 'rip' && onUpdateDevice) {
        const rip = device.ripConfig || { version: 1, networks: [], autoSummary: true };
        onUpdateDevice({ ...device, ripConfig: { ...rip, networks: [...rip.networks, net] } });
      } else if (ctx.currentSubmode === 'eigrp' && onUpdateDevice) {
        const eigrp = device.eigrpConfig || { as: 1, networks: [] };
        onUpdateDevice({ ...device, eigrpConfig: { ...eigrp, networks: [...eigrp.networks, net] } });
      } else if (ctx.currentSubmode === 'bgp' && onUpdateDevice) {
        const bgp = device.bgpConfig || { as: 1, neighbors: [], networks: [] };
        const mask = parts[3] || '255.255.255.0';
        onUpdateDevice({ ...device, bgpConfig: { ...bgp, networks: [...bgp.networks, { network: net, mask }] } });
      }
      return '';
    }
    if (trimmed === 'version 2' && ctx.currentSubmode === 'rip' && onUpdateDevice) {
      onUpdateDevice({ ...device, ripConfig: { ...device.ripConfig!, version: 2 } });
      return '';
    }
    if (trimmed === 'no auto-summary') return '';
    if (trimmed.startsWith('router-id ')) return '';
    if (trimmed.startsWith('passive-interface ')) return '';
    if (trimmed === 'default-information originate') return '';
    if (trimmed.startsWith('neighbor ') && ctx.currentSubmode === 'bgp' && onUpdateDevice) {
      const ip = parts[1];
      const remoteAs = parseInt(parts[3]);
      const bgp = device.bgpConfig || { as: 1, neighbors: [], networks: [] };
      onUpdateDevice({ ...device, bgpConfig: { ...bgp, neighbors: [...bgp.neighbors, { ip, remoteAs }] } });
      return '';
    }
    return `% Unknown router config command: "${parts[0]}"`;
  }

  // === DHCP-CONFIG ===
  if (mode === 'dhcp-config') {
    const pool = device.dhcpPools.find(p => p.name === ctx.currentDhcpPool);
    if (!pool) { ctx.setMode('config'); return ''; }
    if (trimmed.startsWith('network ')) {
      if (onUpdateDevice) {
        onUpdateDevice({ ...device, dhcpPools: device.dhcpPools.map(p => p.name === ctx.currentDhcpPool ? { ...p, network: parts[1], mask: parts[2] || '255.255.255.0' } : p) });
      }
      return '';
    }
    if (trimmed.startsWith('default-router ')) {
      if (onUpdateDevice) onUpdateDevice({ ...device, dhcpPools: device.dhcpPools.map(p => p.name === ctx.currentDhcpPool ? { ...p, defaultRouter: parts[1] } : p) });
      return '';
    }
    if (trimmed.startsWith('dns-server ')) {
      if (onUpdateDevice) onUpdateDevice({ ...device, dhcpPools: device.dhcpPools.map(p => p.name === ctx.currentDhcpPool ? { ...p, dnsServer: parts[1] } : p) });
      return '';
    }
    if (trimmed.startsWith('lease ')) {
      if (onUpdateDevice) onUpdateDevice({ ...device, dhcpPools: device.dhcpPools.map(p => p.name === ctx.currentDhcpPool ? { ...p, leaseTime: parseInt(parts[1]) } : p) });
      return '';
    }
    if (trimmed.startsWith('domain-name ')) return '';
    return `% Unknown DHCP command: "${parts[0]}"`;
  }

  // === CONFIG-LINE ===
  if (mode === 'config-line') {
    if (trimmed === 'login local') return '';
    if (trimmed.startsWith('transport input ')) return '';
    if (trimmed.startsWith('password ')) return '';
    if (trimmed.startsWith('exec-timeout ')) return '';
    return `% Unknown line command: "${parts[0]}"`;
  }

  // === CONFIG-VLAN ===
  if (mode === 'config-vlan') {
    if (trimmed.startsWith('name ')) {
      // rename vlan
      return '';
    }
    return `% Unknown VLAN command: "${parts[0]}"`;
  }

  return `% Unknown command: "${parts[0]}"`;
}

function handlePing(ip: string, ctx: CliContext): string {
  if (!ip) return '% Incomplete command. Usage: ping <ip-address>';
  const result = simulatePing(ctx.device, ip, ctx.allDevices, ctx.connections);
  if (ctx.onPingResult) {
    ctx.onPingResult({
      sourceDevice: ctx.device.name,
      sourceIp: ctx.device.interfaces.find(i => i.ip)?.ip || 'N/A',
      destIp: ip,
      success: result.success,
      reason: result.reason,
    });
  }
  return `Type escape sequence to abort.\n${result.output}`;
}

function handleShow(cmd: string, device: Device, allDevices: Device[], connections: Connection[]): string {
  if (cmd === 'show ip route') {
    const connected = generateConnectedRoutes(device);
    const allRoutes = [...connected, ...device.routingTable];
    // Add OSPF/RIP routes from adjacent routers (simplified)
    const ospfRoutes = getLearnedRoutes(device, allDevices, connections);
    const merged = [...allRoutes, ...ospfRoutes];
    if (merged.length === 0) return 'Codes: C - connected, S - static\n\nGateway of last resort is not set\n\nNo routes configured.';
    let output = 'Codes: C - connected, S - static, R - RIP, O - OSPF, D - EIGRP, B - BGP\n\nGateway of last resort is not set\n\n';
    output += merged.map(r => `${r.type}    ${r.network} ${r.mask}${r.nextHop ? ` via ${r.nextHop}` : ''}${r.interface ? `, ${r.interface}` : ''}`).join('\n');
    return output;
  }
  if (cmd === 'show ip interface brief' || cmd === 'show ip int brief') {
    let output = 'Interface                  IP-Address      OK? Method Status                Protocol\n';
    output += device.interfaces.map(i =>
      `${i.name.padEnd(27)}${(i.ip || 'unassigned').padEnd(16)}YES manual ${i.status === 'up' ? 'up' : 'administratively down'}      ${i.status === 'up' && i.connected ? 'up' : 'down'}`
    ).join('\n');
    return output;
  }
  if (cmd === 'show interfaces' || cmd === 'show int') {
    return device.interfaces.map(i =>
      `${i.name} is ${i.status === 'up' ? 'up' : 'down'}, line protocol is ${i.status === 'up' && i.connected ? 'up' : 'down'}\n  Hardware is ${i.isWireless ? 'Wireless' : 'Ethernet'}, address is ${i.macAddress}\n  Internet address is ${i.ip || 'unassigned'}${i.mask ? ' ' + i.mask : ''}\n  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 100 usec\n  ${i.description ? `Description: ${i.description}` : ''}`
    ).join('\n\n') || 'No interfaces configured';
  }
  if (cmd.startsWith('show interfaces ')) {
    const ifName = cmd.substring(16).trim();
    const iface = device.interfaces.find(i => i.name.toLowerCase().startsWith(ifName.toLowerCase()));
    if (!iface) return `% Invalid interface: ${ifName}`;
    return `${iface.name} is ${iface.status === 'up' ? 'up' : 'down'}, line protocol is ${iface.status === 'up' && iface.connected ? 'up' : 'down'}\n  Hardware is ${iface.isWireless ? 'Wireless' : 'Ethernet'}, address is ${iface.macAddress}\n  Internet address is ${iface.ip || 'unassigned'}${iface.mask ? ' ' + iface.mask : ''}\n  MTU 1500 bytes, BW 1000000 Kbit/sec`;
  }
  if (cmd === 'show running-config' || cmd === 'show run') {
    let config = `Building configuration...\n\nCurrent configuration : ${Math.floor(Math.random() * 500 + 200)} bytes\n!\nhostname ${device.hostname}\n!`;
    if (device.enableSecret) config += `\nenable secret ${device.passwordEncryption ? '5 $1$...' : device.enableSecret}`;
    if (device.banner) config += `\nbanner motd #${device.banner}#`;
    config += '\n!';
    device.interfaces.forEach(i => {
      config += `\ninterface ${i.name}\n ${i.description ? `description ${i.description}\n ` : ''}${i.ip ? `ip address ${i.ip} ${i.mask}\n ` : 'no ip address\n '}${i.status === 'up' ? 'no shutdown' : 'shutdown'}`;
    });
    device.routingTable.filter(r => r.type === 'S').forEach(r => {
      config += `\nip route ${r.network} ${r.mask} ${r.nextHop || ''}`;
    });
    if (device.ospfConfig) {
      config += `\nrouter ospf ${device.ospfConfig.processId}`;
      device.ospfConfig.networks.forEach(n => config += `\n network ${n.network} ${n.wildcard} area ${n.area}`);
    }
    if (device.ripConfig) {
      config += `\nrouter rip\n version ${device.ripConfig.version}`;
      device.ripConfig.networks.forEach(n => config += `\n network ${n}`);
    }
    device.dhcpPools.forEach(p => {
      config += `\nip dhcp pool ${p.name}\n network ${p.network} ${p.mask}`;
      if (p.defaultRouter) config += `\n default-router ${p.defaultRouter}`;
      if (p.dnsServer) config += `\n dns-server ${p.dnsServer}`;
    });
    config += '\n!\nend';
    return config;
  }
  if (cmd === 'show startup-config') return 'Using running configuration as startup configuration.';
  if (cmd === 'show version') return showVersion(device);
  if (cmd === 'show arp' || cmd === 'show ip arp') {
    let output = `Protocol  Address          Age    Hardware Addr   Type   Interface\n`;
    output += device.interfaces.filter(i => i.ip).map(i =>
      `Internet  ${i.ip?.padEnd(17)}  -      ${i.macAddress}  ARPA   ${i.name}`
    ).join('\n');
    if (device.arpTable.length > 0) {
      output += '\n' + device.arpTable.map(a =>
        `Internet  ${a.ip.padEnd(17)}  ${String(a.age).padEnd(5)}  ${a.mac}  ARPA   ${a.interface}`
      ).join('\n');
    }
    return output;
  }
  if (cmd === 'show vlan brief' || cmd === 'show vlan') {
    if (device.type !== 'switch') return '% VLAN information is only available on switches';
    let output = 'VLAN Name                             Status    Ports\n---- -------------------------------- --------- ----------------------------\n';
    output += (device.vlanTable || []).map(v => {
      const ports = device.interfaces.filter(i => (i.vlan || 1) === v.id).map(i => i.name).join(', ');
      return `${String(v.id).padEnd(5)}${v.name.padEnd(33)}${v.status.padEnd(10)}${ports}`;
    }).join('\n');
    return output;
  }
  if (cmd === 'show mac-address-table' || cmd === 'show mac address-table') {
    let output = '          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n';
    output += (device.macTable || []).map(m => `${String(m.vlan).padEnd(8)}${m.mac.padEnd(18)}${m.type.padEnd(12)}${m.interface}`).join('\n');
    return output;
  }
  if (cmd === 'show ip protocols') {
    let output = '';
    if (device.ospfConfig) output += `Routing Protocol is "ospf ${device.ospfConfig.processId}"\n  Outgoing update filter list for all interfaces is not set\n  Incoming update filter list for all interfaces is not set\n  Routing for Networks:\n${device.ospfConfig.networks.map(n => `    ${n.network} ${n.wildcard} area ${n.area}`).join('\n')}\n`;
    if (device.ripConfig) output += `Routing Protocol is "rip"\n  Version: ${device.ripConfig.version}\n  Networks:\n${device.ripConfig.networks.map(n => `    ${n}`).join('\n')}\n`;
    if (!output) output = 'No routing protocols active.';
    return output;
  }
  if (cmd === 'show cdp neighbors') {
    const neighbors: string[] = [];
    connections.forEach(c => {
      const other = c.from === device.id ? allDevices.find(d => d.id === c.to) : (c.to === device.id ? allDevices.find(d => d.id === c.from) : null);
      if (other) neighbors.push(`${other.hostname.padEnd(20)}${(c.from === device.id ? c.fromInterface : c.toInterface).padEnd(20)}${(c.from === device.id ? c.toInterface : c.fromInterface)}`);
    });
    if (neighbors.length === 0) return 'No CDP neighbors found.';
    return `Device ID            Local Intrfce      Port ID\n` + neighbors.join('\n');
  }
  if (cmd === 'show ip dhcp binding') {
    const allLeases = device.dhcpPools.flatMap(p => p.leases);
    if (allLeases.length === 0) return 'No DHCP bindings found.';
    return 'IP address       Client-ID/          Lease expiration\n' + allLeases.map(l => `${l.ip.padEnd(17)}${l.mac.padEnd(20)}${new Date(l.expiry).toLocaleString()}`).join('\n');
  }
  if (cmd === 'show ip dhcp pool') {
    if (device.dhcpPools.length === 0) return 'No DHCP pools configured.';
    return device.dhcpPools.map(p => `Pool ${p.name}:\n  Network: ${p.network} ${p.mask}\n  Default Router: ${p.defaultRouter || 'N/A'}\n  DNS Server: ${p.dnsServer || 'N/A'}\n  Leases: ${p.leases.length}`).join('\n\n');
  }
  if (cmd === 'show ip nat translations') {
    return 'Pro  Inside global     Inside local      Outside local     Outside global\n--- No active NAT translations ---';
  }
  if (cmd === 'show access-lists') {
    const lists = device.accessLists || [];
    if (lists.length === 0) return 'No access lists configured.';
    return lists.map(a => `Extended IP access list ${a.name}\n${a.rules.map((r, i) => `  ${(i + 1) * 10} ${r.action} ${r.protocol} ${r.source} ${r.destination}`).join('\n')}`).join('\n\n');
  }
  if (cmd === 'show interfaces trunk') {
    const trunks = device.interfaces.filter(i => i.switchportMode === 'trunk');
    if (trunks.length === 0) return 'No trunk ports configured.';
    return 'Port        Mode         Encapsulation  Status        Native vlan\n' + trunks.map(t => `${t.name.padEnd(12)}on           802.1q         trunking      1`).join('\n');
  }
  if (cmd === 'show spanning-tree') return 'VLAN0001\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    32769\n  Bridge ID  Priority    32769';
  if (cmd === 'show conn') return '0 in use, 0 most used';
  if (cmd === 'show xlate') return '0 in use, 0 most used';
  return `% Unknown show command: "${cmd}"`;
}

function showVersion(device: Device): string {
  return `NETSEM IOS Software, Version 15.1(4)M\nSystem image file is "flash:c2900-universalk9-mz"\nProcessor board ID FTX1234ABCD\n${device.hostname} uptime is 0 hours, 42 minutes\nSystem returned to ROM by reload\nLast configuration change at 00:00:00 UTC`;
}

function getLearnedRoutes(device: Device, allDevices: Device[], connections: Connection[]): RouteEntry[] {
  const learned: RouteEntry[] = [];
  // Simple OSPF/RIP simulation: learn routes from directly connected routers
  if (device.ospfConfig || device.ripConfig) {
    connections.forEach(c => {
      const neighborId = c.from === device.id ? c.to : (c.to === device.id ? c.from : null);
      if (!neighborId) return;
      const neighbor = allDevices.find(d => d.id === neighborId);
      if (!neighbor || neighbor.type !== 'router') return;
      // Learn connected routes from neighbor
      const neighborRoutes = generateConnectedRoutes(neighbor);
      neighborRoutes.forEach(r => {
        // Don't learn routes for networks we're already connected to
        const myConnected = generateConnectedRoutes(device);
        if (!myConnected.find(mr => mr.network === r.network && mr.mask === r.mask)) {
          const nextHopIface = neighbor.interfaces.find(i => i.ip && i.connected);
          if (nextHopIface?.ip) {
            const type = device.ospfConfig ? 'O' : device.ripConfig ? 'R' : 'S';
            if (!learned.find(lr => lr.network === r.network && lr.mask === r.mask)) {
              learned.push({ network: r.network, mask: r.mask, nextHop: nextHopIface.ip, type: type as RouteEntry['type'] });
            }
          }
        }
      });
    });
  }
  return learned;
}

function getHelpForMode(mode: string): string {
  switch (mode) {
    case 'user': return 'User EXEC commands:\n  enable          Enter privileged EXEC mode\n  ping            Send echo messages\n  traceroute      Trace route to destination\n  show            Show running system information\n  exit            Exit the CLI';
    case 'privileged': return 'Privileged EXEC commands:\n  configure terminal  Enter configuration mode\n  show ip route       Display routing table\n  show ip interface brief  Display interface summary\n  show running-config Display current config\n  show version        Display system info\n  show arp            Display ARP table\n  show cdp neighbors  Display CDP neighbors\n  ping <ip>           Send ICMP echo\n  traceroute <ip>     Trace route\n  copy run start      Save configuration\n  write memory        Save configuration\n  debug ip icmp       Enable ICMP debugging';
    case 'config': return 'Global configuration commands:\n  hostname <name>     Set hostname\n  interface <name>    Enter interface config\n  ip route <net> <mask> <hop>  Add static route\n  router ospf <id>    Enter OSPF config\n  router rip          Enter RIP config\n  ip dhcp pool <name> Create DHCP pool\n  ip access-list extended <name>  Create ACL\n  banner motd #text#  Set banner\n  enable secret <pw>  Set enable password\n  vlan <id>           Create VLAN (switch)\n  line vty 0 4        Configure VTY lines\n  exit                Return to privileged mode';
    case 'config-if': return 'Interface configuration commands:\n  ip address <ip> <mask>  Set IP address\n  ip address dhcp         Request IP via DHCP\n  no ip address           Remove IP\n  no shutdown             Enable interface\n  shutdown                Disable interface\n  description <text>      Set description\n  switchport mode <mode>  Set switchport mode\n  switchport access vlan <id>  Set access VLAN\n  ip nat inside/outside   Mark NAT direction\n  exit                    Return to global config';
    case 'config-router': return 'Router configuration commands:\n  network <net> <wildcard> area <id>  Add network (OSPF)\n  network <net>            Add network (RIP)\n  version 2                Set RIP version\n  no auto-summary          Disable auto-summary\n  passive-interface <if>   Set passive interface\n  exit                     Return to global config';
    case 'dhcp-config': return 'DHCP pool configuration:\n  network <net> <mask>  Set pool network\n  default-router <ip>   Set default gateway\n  dns-server <ip>       Set DNS server\n  lease <days>          Set lease time\n  exit                  Return to global config';
    default: return 'Type "exit" to return to previous mode.';
  }
}

export function getRouterPrompt(device: Device, mode: string, currentInterface: string): string {
  const h = device.hostname || device.name;
  switch (mode) {
    case 'user': return `${h}>`;
    case 'privileged': return `${h}#`;
    case 'config': return `${h}(config)#`;
    case 'config-if': return `${h}(config-if)#`;
    case 'config-router': return `${h}(config-router)#`;
    case 'dhcp-config': return `${h}(dhcp-config)#`;
    case 'config-line': return `${h}(config-line)#`;
    case 'config-vlan': return `${h}(config-vlan)#`;
    default: return `${h}>`;
  }
}

export function getRouterCompletions(mode: string, device: Device): Record<string, string[]> {
  const ifaces = device.interfaces.map(i => i.name);
  const base: Record<string, string[]> = {};

  if (mode === 'user') {
    base[''] = ['enable', 'ping', 'traceroute', 'show', 'exit', 'help'];
    base['show'] = ['version'];
  } else if (mode === 'privileged') {
    base[''] = ['configure', 'show', 'ping', 'traceroute', 'copy', 'write', 'debug', 'no', 'clock', 'terminal', 'exit', 'help'];
    base['configure'] = ['terminal'];
    base['show'] = ['ip', 'interfaces', 'running-config', 'startup-config', 'version', 'arp', 'mac-address-table', 'vlan', 'cdp', 'access-lists', 'spanning-tree'];
    base['show ip'] = ['route', 'interface', 'arp', 'protocols', 'dhcp', 'nat'];
    base['show ip dhcp'] = ['binding', 'pool'];
    base['show ip nat'] = ['translations'];
    base['show cdp'] = ['neighbors'];
    base['copy'] = ['running-config'];
    base['copy running-config'] = ['startup-config', 'tftp'];
    base['debug'] = ['ip'];
    base['debug ip'] = ['icmp'];
  } else if (mode === 'config') {
    base[''] = ['hostname', 'interface', 'ip', 'router', 'no', 'banner', 'enable', 'service', 'line', 'vlan', 'logging', 'ntp', 'snmp-server', 'spanning-tree', 'exit', 'end', 'help'];
    base['interface'] = ifaces;
    base['ip'] = ['route', 'dhcp', 'access-list', 'nat', 'name-server', 'domain-name'];
    base['ip dhcp'] = ['pool', 'excluded-address'];
    base['ip access-list'] = ['extended'];
    base['router'] = ['ospf', 'rip', 'eigrp', 'bgp'];
    base['line'] = ['vty', 'console'];
    base['enable'] = ['secret'];
    base['banner'] = ['motd'];
    base['service'] = ['password-encryption'];
  } else if (mode === 'config-if') {
    base[''] = ['ip', 'no', 'shutdown', 'description', 'duplex', 'speed', 'switchport', 'spanning-tree', 'encapsulation', 'exit', 'end', 'help'];
    base['ip'] = ['address', 'nat', 'access-group', 'helper-address'];
    base['no'] = ['shutdown', 'ip'];
    base['switchport'] = ['mode', 'access', 'trunk'];
    base['switchport mode'] = ['access', 'trunk'];
    base['switchport access'] = ['vlan'];
    base['switchport trunk'] = ['allowed', 'native'];
    base['ip nat'] = ['inside', 'outside'];
  } else if (mode === 'config-router') {
    base[''] = ['network', 'version', 'no', 'router-id', 'passive-interface', 'default-information', 'neighbor', 'exit', 'end', 'help'];
  } else if (mode === 'dhcp-config') {
    base[''] = ['network', 'default-router', 'dns-server', 'lease', 'domain-name', 'exit', 'end', 'help'];
  } else if (mode === 'config-line') {
    base[''] = ['login', 'transport', 'password', 'exec-timeout', 'exit', 'end', 'help'];
    base['transport'] = ['input'];
    base['transport input'] = ['ssh', 'telnet'];
  }

  return base;
}