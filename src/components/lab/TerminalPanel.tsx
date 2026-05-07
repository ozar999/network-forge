import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Device } from './types';
import { generateConnectedRoutes, simulatePing, simulateTraceroute } from './networkEngine';

import type { PingResult } from './PingResultPopup';

interface TerminalPanelProps {
  device: Device | null;
  onCommand: (deviceId: string, command: string) => string;
  allDevices?: Device[];
  connections?: import('./types').Connection[];
  onUpdateDevice?: (device: Device) => void;
  onPingResult?: (result: PingResult) => void;
}

interface TerminalLine {
  type: 'input' | 'output';
  text: string;
}

function getCiscoCommands(device: Device | null): Record<string, string[]> {
  const ifaces = device?.interfaces.map(i => i.name) || [];
  const isPcLike = device?.type === 'pc' || device?.type === 'laptop';
  if (isPcLike) {
    return {
      '': ['ipconfig', 'ping', 'tracert', 'arp', 'nslookup', 'help', 'clear'],
      'ipconfig': ['/all'],
    };
  }
  if (device?.type === 'server') {
    return {
      '': ['ifconfig', 'ip', 'ping', 'traceroute', 'netstat', 'service', 'help', 'clear'],
      'ip': ['addr', 'route'],
      'service': ['dhcpd', 'httpd', 'named'],
    };
  }
  return {
    '': ['enable', 'show', 'ping', 'traceroute', 'exit', 'configure', 'hostname', 'help', 'clear'],
    'show': ['ip', 'interfaces', 'running-config', 'version', 'arp', 'mac-address-table', 'vlan'],
    'show ip': ['route', 'interface', 'arp', 'protocols'],
    'configure': ['terminal'],
    'interface': ifaces,
    'ip': ['address', 'route', 'dhcp'],
    'ip dhcp': ['pool', 'excluded-address'],
    'router': ['ospf', 'eigrp', 'bgp', 'rip'],
    'switchport': ['mode', 'access'],
    'switchport mode': ['access', 'trunk'],
    'switchport access': ['vlan'],
  };
}

export function TerminalPanel({ device, onCommand, allDevices = [], connections = [], onUpdateDevice, onPingResult }: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mode, setMode] = useState<'user' | 'privileged' | 'config' | 'config-if'>('user');
  const [currentInterface, setCurrentInterface] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hostname = device?.hostname || device?.name || 'Router';
  const isPcLike = device?.type === 'pc' || device?.type === 'laptop';
  const isServer = device?.type === 'server';

  const getPrompt = useCallback(() => {
    if (isPcLike) return `C:\\>`;
    if (isServer) return `${hostname}$`;
    switch (mode) {
      case 'user': return `${hostname}>`;
      case 'privileged': return `${hostname}#`;
      case 'config': return `${hostname}(config)#`;
      case 'config-if': return `${hostname}(config-if:${currentInterface})#`;
    }
  }, [hostname, mode, isPcLike, isServer, currentInterface]);

  useEffect(() => {
    if (device) {
      setLines([
        { type: 'output', text: `\n${device.name} Console` },
        { type: 'output', text: `Type "help" for available commands\n` },
      ]);
      setMode('user');
    }
  }, [device?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const processCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    const parts = cmd.trim().split(/\s+/);
    let output = '';

    if (trimmed === 'clear') {
      setLines([]);
      return '';
    }

    // PC/Laptop commands
    if (isPcLike && device) {
      return processPcCommand(trimmed, parts, device);
    }

    // Server commands
    if (isServer && device) {
      return processServerCommand(trimmed, parts, device);
    }

    // Cisco IOS commands
    if (trimmed === 'help' || trimmed === '?') {
      output = 'Available commands:\n  enable          - Enter privileged EXEC mode\n  configure terminal - Enter global configuration mode\n  show ip route   - Display IP routing table\n  show ip interface brief - Display interface summary\n  show interfaces - Display interface status\n  show running-config - Display current configuration\n  show version    - Display system version\n  show arp        - Display ARP table\n  show vlan       - Display VLAN table\n  ping <ip>       - Send ICMP echo\n  traceroute <ip> - Trace route to destination\n  hostname <name> - Set device hostname\n  interface <name> - Configure interface\n  ip address <ip> <mask> - Set IP address\n  ip route <net> <mask> <next-hop> - Add static route\n  no shutdown     - Enable interface\n  copy running-config startup-config - Save config\n  exit            - Exit current mode';
    } else if (trimmed === 'enable') {
      setMode('privileged');
      output = '';
    } else if (trimmed === 'conf t' || trimmed === 'configure terminal') {
      if (mode === 'privileged' || mode === 'config') {
        setMode('config');
        output = 'Enter configuration commands, one per line. End with CNTL/Z.';
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed.startsWith('interface ')) {
      if (mode === 'config') {
        const ifName = cmd.trim().substring(10).trim();
        const iface = device?.interfaces.find(i =>
          i.name.toLowerCase() === ifName.toLowerCase() ||
          i.name.toLowerCase().startsWith(ifName.toLowerCase())
        );
        if (iface) {
          setCurrentInterface(iface.name);
        } else {
          return `% Invalid interface: ${ifName}`;
        }
        setMode('config-if');
        output = '';
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed === 'exit') {
      if (mode === 'config-if') setMode('config');
      else if (mode === 'config') setMode('privileged');
      else if (mode === 'privileged') setMode('user');
      output = '';
    } else if (trimmed === 'show ip route') {
      if (device) {
        const connected = generateConnectedRoutes(device);
        const allRoutes = [...connected, ...device.routingTable];
        if (allRoutes.length === 0) {
          output = 'Codes: C - connected, S - static\n\nGateway of last resort is not set\n\nNo routes configured.';
        } else {
          output = 'Codes: C - connected, S - static, R - RIP, O - OSPF\n\nGateway of last resort is not set\n\n';
          output += allRoutes.map(r =>
            `${r.type}    ${r.network} ${r.mask}${r.nextHop ? ` via ${r.nextHop}` : ''}${r.interface ? ` is directly connected, ${r.interface}` : ''}`
          ).join('\n');
        }
      }
    } else if (trimmed === 'show ip interface brief') {
      if (device) {
        output = 'Interface                  IP-Address      OK? Method Status                Protocol\n';
        output += device.interfaces.map(i =>
          `${i.name.padEnd(27)}${(i.ip || 'unassigned').padEnd(16)}YES manual ${i.status === 'up' && i.connected ? 'up' : 'administratively down'}      ${i.status === 'up' && i.connected ? 'up' : 'down'}`
        ).join('\n');
      }
    } else if (trimmed === 'show interfaces' || trimmed === 'show int') {
      const ifaces = device?.interfaces || [];
      output = ifaces.map(i =>
        `${i.name} is ${i.status === 'up' && i.connected ? 'up' : 'down'}, line protocol is ${i.status === 'up' && i.connected ? 'up' : 'down'}\n  Hardware is ${i.isWireless ? 'Wireless' : 'Ethernet'}, address is ${i.macAddress}\n  Internet address is ${i.ip || 'unassigned'}${i.mask ? ' ' + i.mask : ''}\n  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 100 usec\n  ${i.description ? `Description: ${i.description}` : ''}`
      ).join('\n\n');
      if (!output) output = 'No interfaces configured';
    } else if (trimmed === 'show running-config' || trimmed === 'show run') {
      output = `Building configuration...\n\nCurrent configuration : 512 bytes\n!\nhostname ${hostname}\n!\n${(device?.interfaces || []).map(i =>
        `interface ${i.name}\n ${i.description ? `description ${i.description}` : ''}\n ${i.ip ? `ip address ${i.ip} ${i.mask}` : 'no ip address'}\n ${i.status === 'up' ? 'no shutdown' : 'shutdown'}`
      ).join('\n!\n')}\n!\nend`;
    } else if (trimmed === 'show version') {
      output = `NETSEM IOS Software, Version 15.1(4)M\nSystem image file is "flash:c2900-universalk9-mz"\nProcessor board ID FTX1234ABCD\n${hostname} uptime is 0 hours, 42 minutes`;
    } else if (trimmed === 'show arp') {
      if (device) {
        if (device.arpTable.length === 0) {
          // Generate from connected interfaces
          output = `Protocol  Address          Age    Hardware Addr   Type   Interface\n`;
          output += device.interfaces.filter(i => i.ip).map(i =>
            `Internet  ${i.ip?.padEnd(17)}  -      ${i.macAddress}  ARPA   ${i.name}`
          ).join('\n');
        } else {
          output = `Protocol  Address          Age    Hardware Addr   Type   Interface\n`;
          output += device.arpTable.map(a =>
            `Internet  ${a.ip.padEnd(17)}  ${String(a.age).padEnd(5)}  ${a.mac}  ARPA   ${a.interface}`
          ).join('\n');
        }
      }
    } else if (trimmed === 'show vlan' || trimmed === 'show vlan brief') {
      if (device && device.type === 'switch') {
        output = 'VLAN Name                             Status    Ports\n---- -------------------------------- --------- ----------------------------\n';
        output += (device.vlanTable || []).map(v => {
          const ports = device.interfaces.filter(i => (i.vlan || 1) === v.id).map(i => i.name).join(', ');
          return `${String(v.id).padEnd(5)}${v.name.padEnd(33)}${v.status.padEnd(10)}${ports}`;
        }).join('\n');
      } else {
        output = '% VLAN information is only available on switches';
      }
    } else if (trimmed === 'show mac-address-table' || trimmed === 'show mac address-table') {
      if (device && device.type === 'switch') {
        output = '          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n';
        output += (device.macTable || []).map(m =>
          `${String(m.vlan).padEnd(8)}${m.mac.padEnd(18)}${m.type.padEnd(12)}${m.interface}`
        ).join('\n');
      }
    } else if (trimmed.startsWith('ping ')) {
      const ip = parts[1];
      if (device && ip) {
        const result = simulatePing(device, ip, allDevices, connections);
        output = `Type escape sequence to abort.\n${result.output}`;
        if (onPingResult) {
          onPingResult({
            sourceDevice: device.name,
            sourceIp: device.interfaces.find(i => i.ip)?.ip || 'N/A',
            destIp: ip,
            success: result.success,
            reason: result.reason,
          });
        }
      } else {
        output = '% Incomplete command. Usage: ping <ip-address>';
      }
    } else if (trimmed.startsWith('traceroute ') || trimmed.startsWith('tracert ')) {
      const ip = parts[1];
      if (device && ip) {
        output = simulateTraceroute(device, ip, allDevices, connections);
      }
    } else if (trimmed.startsWith('ip address ')) {
      if (mode === 'config-if') {
        const addrParts = cmd.trim().split(/\s+/);
        const ip = addrParts[2];
        const mask = addrParts[3];
        if (ip && mask && device && onUpdateDevice) {
          const newDevice = { ...device, interfaces: device.interfaces.map(i =>
            i.name === currentInterface ? { ...i, ip, mask } : i
          )};
          onUpdateDevice(newDevice);
          output = '';
        } else {
          output = '% Incomplete command. Usage: ip address <ip> <mask>';
        }
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed.startsWith('ip route ')) {
      if ((mode === 'config' || mode === 'privileged') && device && onUpdateDevice) {
        const rParts = cmd.trim().split(/\s+/);
        const net = rParts[2];
        const mask = rParts[3];
        const nextHop = rParts[4];
        if (net && mask && nextHop) {
          onUpdateDevice({
            ...device,
            routingTable: [...device.routingTable, { network: net, mask, nextHop, type: 'S' }],
          });
          output = '';
        } else {
          output = '% Incomplete command. Usage: ip route <network> <mask> <next-hop>';
        }
      }
    } else if (trimmed.startsWith('hostname ')) {
      if (mode === 'config' && device && onUpdateDevice) {
        const newHostname = cmd.trim().substring(9).trim();
        onUpdateDevice({ ...device, hostname: newHostname, name: newHostname });
        output = '';
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed === 'no shutdown') {
      if (mode === 'config-if') {
        if (device && onUpdateDevice) {
          onUpdateDevice({
            ...device,
            interfaces: device.interfaces.map(i =>
              i.name === currentInterface ? { ...i, status: 'up' as const } : i
            ),
          });
        }
        output = '%LINK-3-UPDOWN: Interface changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol changed state to up';
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed === 'shutdown') {
      if (mode === 'config-if') {
        if (device && onUpdateDevice) {
          onUpdateDevice({
            ...device,
            interfaces: device.interfaces.map(i =>
              i.name === currentInterface ? { ...i, status: 'down' as const } : i
            ),
          });
        }
        output = '%LINK-3-UPDOWN: Interface changed state to down\n%LINEPROTO-5-UPDOWN: Line protocol changed state to down';
      }
    } else if (trimmed.startsWith('description ')) {
      if (mode === 'config-if' && device && onUpdateDevice) {
        const desc = cmd.trim().substring(12);
        onUpdateDevice({
          ...device,
          interfaces: device.interfaces.map(i =>
            i.name === currentInterface ? { ...i, description: desc } : i
          ),
        });
        output = '';
      }
    } else if (trimmed.startsWith('switchport mode ')) {
      if (mode === 'config-if' && device?.type === 'switch' && onUpdateDevice) {
        const swMode = parts[2] as 'access' | 'trunk';
        onUpdateDevice({
          ...device,
          interfaces: device.interfaces.map(i =>
            i.name === currentInterface ? { ...i, switchportMode: swMode } : i
          ),
        });
        output = '';
      }
    } else if (trimmed.startsWith('switchport access vlan ')) {
      if (mode === 'config-if' && device?.type === 'switch' && onUpdateDevice) {
        const vlanId = parseInt(parts[3]);
        onUpdateDevice({
          ...device,
          interfaces: device.interfaces.map(i =>
            i.name === currentInterface ? { ...i, vlan: vlanId } : i
          ),
        });
        output = '';
      }
    } else if (trimmed === 'copy running-config startup-config' || trimmed === 'copy run start' || trimmed === 'wr' || trimmed === 'write') {
      output = 'Building configuration...\n[OK]';
    } else if (trimmed === '') {
      output = '';
    } else {
      output = device ? onCommand(device.id, cmd) : '% No device selected';
    }

    return output;
  };

  const processPcCommand = (trimmed: string, parts: string[], dev: Device): string => {
    if (trimmed === 'help' || trimmed === '?') {
      return 'Available commands:\n  ipconfig        - Display IP configuration\n  ipconfig /all   - Display detailed IP configuration\n  ping <ip>       - Send ICMP echo\n  tracert <ip>    - Trace route\n  arp -a          - Display ARP table\n  nslookup <name> - DNS lookup\n  clear           - Clear screen';
    }
    if (trimmed === 'ipconfig') {
      return dev.interfaces.map(i =>
        `${i.isWireless ? 'Wireless' : 'Ethernet'} adapter ${i.name}:\n\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . : ${i.ip || 'Not configured'}\n   Subnet Mask . . . . . . . . . . : ${i.mask || 'Not configured'}\n   Default Gateway . . . . . . . . : ${dev.defaultGateway || 'Not configured'}`
      ).join('\n\n');
    }
    if (trimmed === 'ipconfig /all') {
      return dev.interfaces.map(i =>
        `${i.isWireless ? 'Wireless' : 'Ethernet'} adapter ${i.name}:\n\n   Description . . . . . . . . . . : ${i.isWireless ? 'Wireless Network Adapter' : 'Ethernet Adapter'}\n   Physical Address. . . . . . . . : ${i.macAddress}\n   DHCP Enabled. . . . . . . . . . : ${dev.dhcpEnabled ? 'Yes' : 'No'}\n   IPv4 Address. . . . . . . . . . : ${i.ip || 'Not configured'}\n   Subnet Mask . . . . . . . . . . : ${i.mask || 'Not configured'}\n   Default Gateway . . . . . . . . : ${dev.defaultGateway || 'Not configured'}\n   DNS Server  . . . . . . . . . . : ${dev.dnsServer || 'Not configured'}`
      ).join('\n\n');
    }
    if (trimmed.startsWith('ping ')) {
      const ip = parts[1];
      if (ip) {
        const result = simulatePing(dev, ip, allDevices, connections);
        if (onPingResult) {
          onPingResult({
            sourceDevice: dev.name,
            sourceIp: dev.interfaces.find(i => i.ip)?.ip || 'N/A',
            destIp: ip,
            success: result.success,
            reason: result.reason,
          });
        }
        return `Pinging ${ip} with 32 bytes of data:\n${result.success ? 'Reply from ' + ip + ': bytes=32 time<1ms TTL=128\nReply from ' + ip + ': bytes=32 time<1ms TTL=128\nReply from ' + ip + ': bytes=32 time<1ms TTL=128\nReply from ' + ip + ': bytes=32 time<1ms TTL=128' : 'Request timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.'}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = ${result.success ? 4 : 0}, Lost = ${result.success ? 0 : 4} (${result.success ? 0 : 100}% loss)`;
      }
    }
    if (trimmed.startsWith('tracert ')) {
      const ip = parts[1];
      if (ip) return simulateTraceroute(dev, ip, allDevices, connections);
    }
    if (trimmed === 'arp -a') {
      if (dev.arpTable.length === 0) {
        return 'No ARP Entries Found.';
      }
      return '  Internet Address      Physical Address      Type\n' +
        dev.arpTable.map(a => `  ${a.ip.padEnd(22)}${a.mac.padEnd(22)}dynamic`).join('\n');
    }
    if (trimmed.startsWith('nslookup ')) {
      return `Server:  ${dev.dnsServer || 'Unknown'}\nAddress: ${dev.dnsServer || 'N/A'}\n\n*** ${dev.dnsServer || 'dns'} can't find ${parts[1]}: Non-existent domain`;
    }
    return `'${parts[0]}' is not recognized as an internal or external command.`;
  };

  const processServerCommand = (trimmed: string, parts: string[], dev: Device): string => {
    if (trimmed === 'help' || trimmed === '?') {
      return 'Available commands:\n  ifconfig        - Display network interfaces\n  ip addr         - Display IP addresses\n  ip route        - Display routing table\n  ping <ip>       - Send ICMP echo\n  traceroute <ip> - Trace route\n  netstat -tlnp   - Show listening ports\n  service <name> start/stop - Manage services\n  clear           - Clear screen';
    }
    if (trimmed === 'ifconfig' || trimmed === 'ip addr') {
      return dev.interfaces.map(i =>
        `${i.name}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n    inet ${i.ip || 'not configured'}  netmask ${i.mask || 'N/A'}\n    ether ${i.macAddress}  txqueuelen 1000`
      ).join('\n\n');
    }
    if (trimmed === 'ip route') {
      const routes = generateConnectedRoutes(dev);
      if (routes.length === 0) return 'No routes configured.';
      return routes.map(r => `${r.network}/${r.mask} dev ${r.interface} proto kernel scope link`).join('\n');
    }
    if (trimmed.startsWith('ping ')) {
      const ip = parts[1];
      if (ip) {
        const result = simulatePing(dev, ip, allDevices, connections);
        return `PING ${ip} 56(84) bytes of data.\n${result.success ? `64 bytes from ${ip}: icmp_seq=1 ttl=64 time=0.5 ms\n64 bytes from ${ip}: icmp_seq=2 ttl=64 time=0.4 ms\n--- ${ip} ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss` : `--- ${ip} ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss`}`;
      }
    }
    if (trimmed.startsWith('traceroute ')) {
      const ip = parts[1];
      if (ip) return simulateTraceroute(dev, ip, allDevices, connections);
    }
    if (trimmed === 'netstat -tlnp' || trimmed === 'netstat') {
      const running = dev.services.filter(s => s.enabled);
      if (running.length === 0) return 'No active connections.';
      return 'Proto Recv-Q Send-Q Local Address           State       PID/Program\n' +
        running.map(s => `tcp   0      0      0.0.0.0:${String(s.port).padEnd(16)}LISTEN      -/${s.type}`).join('\n');
    }
    return `-bash: ${parts[0]}: command not found`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = getPrompt();
    const newLines: TerminalLine[] = [
      ...lines,
      { type: 'input', text: `${prompt} ${input}` },
    ];

    const output = processCommand(input);
    if (output) {
      newLines.push({ type: 'output', text: output });
    }

    setLines(newLines);
    if (input.trim()) {
      setHistory(prev => [input, ...prev]);
    }
    setInput('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const next = historyIndex + 1;
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setInput(history[next]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion
      const parts = input.trim().split(' ');
      const prefix = parts.slice(0, -1).join(' ');
      const partial = parts[parts.length - 1].toLowerCase();
      const cmds = getCiscoCommands(device);
      const candidates = cmds[prefix] || cmds[''] || [];
      const match = candidates.find(c => c.toLowerCase().startsWith(partial));
      if (match) {
        setInput(prefix ? `${prefix} ${match}` : match);
      }
    }
  };

  if (!device) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Select a device to open terminal</p>
          <p className="text-xs mt-1 opacity-60">Click any device on the canvas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/50">
        <div className={`w-2 h-2 rounded-full ${device.status === 'up' ? 'bg-terminal status-pulse' : 'bg-noc-red'}`} />
        <span className="text-xs font-semibold text-terminal">{device.name} — Console</span>
        <span className="text-xs text-muted-foreground ml-auto">{device.type.toUpperCase()}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={line.type === 'input' ? 'text-terminal-bright' : 'text-terminal whitespace-pre-wrap'}>
            {line.text}
          </div>
        ))}
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-terminal-bright mr-1">{getPrompt()}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-terminal-bright outline-none caret-terminal"
            autoFocus
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  );
}