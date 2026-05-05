import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Device } from './types';

interface TerminalPanelProps {
  device: Device | null;
  onCommand: (deviceId: string, command: string) => string;
}

interface TerminalLine {
  type: 'input' | 'output';
  text: string;
}

const CISCO_COMMANDS: Record<string, string[]> = {
  '': ['enable', 'show', 'ping', 'traceroute', 'exit', 'configure', 'help'],
  'show': ['ip', 'interfaces', 'running-config', 'version', 'arp', 'mac-address-table'],
  'show ip': ['route', 'interface', 'arp', 'protocols', 'ospf'],
  'configure': ['terminal'],
  'interface': ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'FastEthernet0/1', 'Ethernet0'],
  'ip': ['address', 'route'],
  'router': ['ospf', 'eigrp', 'bgp', 'rip'],
};

export function TerminalPanel({ device, onCommand }: TerminalPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mode, setMode] = useState<'user' | 'privileged' | 'config' | 'config-if'>('user');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hostname = device?.name || 'Router';

  const getPrompt = useCallback(() => {
    switch (mode) {
      case 'user': return `${hostname}>`;
      case 'privileged': return `${hostname}#`;
      case 'config': return `${hostname}(config)#`;
      case 'config-if': return `${hostname}(config-if)#`;
    }
  }, [hostname, mode]);

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
    let output = '';

    if (trimmed === 'help' || trimmed === '?') {
      output = 'Available commands:\n  enable          - Enter privileged EXEC mode\n  configure terminal - Enter global configuration mode\n  show ip route   - Display IP routing table\n  show interfaces - Display interface status\n  show running-config - Display current configuration\n  show version    - Display system version\n  show arp        - Display ARP table\n  ping <ip>       - Send ICMP echo\n  interface <name> - Configure interface\n  ip address <ip> <mask> - Set IP address\n  no shutdown     - Enable interface\n  exit            - Exit current mode';
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
      output = `Codes: C - connected, S - static, R - RIP, O - OSPF\n\nGateway of last resort is not set\n\n      10.0.0.0/24 is subnetted, 2 subnets\nC        10.0.1.0 is directly connected, GigabitEthernet0/0\nC        10.0.2.0 is directly connected, GigabitEthernet0/1`;
    } else if (trimmed === 'show interfaces' || trimmed === 'show int') {
      const ifaces = device?.interfaces || [];
      output = ifaces.map(i =>
        `${i.name} is ${i.connected ? 'up' : 'down'}, line protocol is ${i.connected ? 'up' : 'down'}\n  Internet address is ${i.ip || 'unassigned'}${i.mask ? '/' + i.mask : ''}\n  MTU 1500 bytes, BW 1000000 Kbit/sec`
      ).join('\n\n');
      if (!output) output = 'No interfaces configured';
    } else if (trimmed === 'show running-config' || trimmed === 'show run') {
      output = `Building configuration...\n\nCurrent configuration : 512 bytes\n!\nhostname ${hostname}\n!\n${(device?.interfaces || []).map(i =>
        `interface ${i.name}\n ${i.ip ? `ip address ${i.ip} ${i.mask}` : 'no ip address'}\n ${i.connected ? 'no shutdown' : 'shutdown'}`
      ).join('\n!\n')}\n!\nend`;
    } else if (trimmed === 'show version') {
      output = `NetSim IOS Software, Version 15.1(4)M\nSystem image file is "flash:c2900-universalk9-mz"\nProcessor board ID FTX1234ABCD\n${hostname} uptime is 0 hours, 42 minutes`;
    } else if (trimmed === 'show arp') {
      output = `Protocol  Address          Age    Hardware Addr   Type   Interface\nInternet  10.0.1.1         -      aabb.cc00.0100  ARPA   GigabitEthernet0/0\nInternet  10.0.1.2         5      aabb.cc00.0200  ARPA   GigabitEthernet0/0`;
    } else if (trimmed.startsWith('ping ')) {
      const ip = trimmed.split(' ')[1];
      output = `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`;
    } else if (trimmed.startsWith('ip address ')) {
      if (mode === 'config-if') {
        output = '';
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed === 'no shutdown') {
      if (mode === 'config-if') {
        output = '%LINK-3-UPDOWN: Interface changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol changed state to up';
      } else {
        output = '% Invalid input detected';
      }
    } else if (trimmed === '') {
      output = '';
    } else {
      output = device ? onCommand(device.id, cmd) : '% No device selected';
    }

    return output;
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
      const candidates = CISCO_COMMANDS[prefix] || CISCO_COMMANDS[''] || [];
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