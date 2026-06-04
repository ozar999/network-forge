import { useState, useCallback, useRef, useEffect } from 'react';
import type { Device, Connection, Packet, DeviceType, SavedLab } from './types';
import { DEVICE_DEFAULTS, generateMac, type NetworkInterface } from './types';
import { trackEvent } from '@/lib/progress';

let deviceCounter = 0;
let connectionCounter = 0;

const WORKSPACE_KEY = 'netsem_workspace';
const LABS_KEY = 'netsem-labs';

function createDevice(type: DeviceType, x: number, y: number): Device {
  deviceCounter++;
  const defaults = DEVICE_DEFAULTS[type];
  const name = `${type.charAt(0).toUpperCase() + type.slice(1)}${deviceCounter}`;
  return {
    id: `device-${deviceCounter}`,
    type,
    name,
    x,
    y,
    status: 'up',
    interfaces: defaults.interfaces.map(iface => ({
      name: iface,
      connected: false,
      status: 'up' as const,
      macAddress: generateMac(),
      isWireless: /wireless/i.test(iface) || (type === 'accesspoint' && iface !== 'Ethernet0'),
    })),
    config: [],
    hostname: name,
    routingTable: [],
    arpTable: [],
    macTable: [],
    dhcpPools: [],
    services: defaults.defaultServices ? [...defaults.defaultServices] : [],
    vlanTable: type === 'switch' ? [{ id: 1, name: 'default', status: 'active' as const }] : [],
    dhcpEnabled: type === 'pc' || type === 'laptop',
    ...(type === 'accesspoint' ? { ssid: `AP_${deviceCounter}`, wpaPassword: '', channel: 1, apMode: 'ap' as const } : {}),
  };
}

interface WorkspaceState {
  devices: Device[];
  connections: Connection[];
  deviceCounter: number;
  connectionCounter: number;
}

function loadWorkspace(): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveWorkspace(devices: Device[], connections: Connection[]) {
  try {
    const state: WorkspaceState = { devices, connections, deviceCounter, connectionCounter };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
  } catch {}
}

export function useLabState() {
  const [devices, setDevices] = useState<Device[]>(() => {
    const ws = loadWorkspace();
    if (ws) { deviceCounter = ws.deviceCounter; connectionCounter = ws.connectionCounter; return ws.devices; }
    return [];
  });
  const [connections, setConnections] = useState<Connection[]>(() => {
    const ws = loadWorkspace();
    return ws?.connections || [];
  });
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Auto-save on every change
  useEffect(() => {
    saveWorkspace(devices, connections);
  }, [devices, connections]);

  const addDevice = useCallback((type: DeviceType, x: number, y: number) => {
    const device = createDevice(type, x, y);
    setDevices(prev => [...prev, device]);
    trackEvent('device_added', { type });
    return device;
  }, []);

  const removeDevice = useCallback((id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selectedDevice === id) setSelectedDevice(null);
  }, [selectedDevice]);

  const removeConnection = useCallback((connId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connId));
    setDevices(prev => prev.map(d => ({
      ...d,
      interfaces: d.interfaces.map(i => i.connectionId === connId
        ? { ...i, connected: false, connectedTo: undefined, connectedInterface: undefined, connectionId: undefined }
        : i),
    })));
  }, []);

  const connectWireless = useCallback((clientId: string, apId: string) => {
    const client = devices.find(d => d.id === clientId);
    const ap = devices.find(d => d.id === apId);
    if (!client || !ap) return;
    const cIface = client.interfaces.find(i => i.isWireless && !i.connected);
    const aIface = ap.interfaces.find(i => i.name !== 'Ethernet0' && !i.connected) || ap.interfaces.find(i => i.isWireless && !i.connected);
    if (!cIface || !aIface) return;
    connectionCounter++;
    const conn: Connection = {
      id: `conn-${connectionCounter}`,
      from: clientId, to: apId,
      fromInterface: cIface.name, toInterface: aIface.name,
      type: 'wireless',
    };
    setConnections(prev => [...prev, conn]);
    setDevices(prev => prev.map(d => {
      if (d.id === clientId) return { ...d, interfaces: d.interfaces.map(i => i.name === cIface.name ? { ...i, connected: true, connectedTo: apId, connectedInterface: aIface.name, connectionId: conn.id } : i) };
      if (d.id === apId) return { ...d, interfaces: d.interfaces.map(i => i.name === aIface.name ? { ...i, connected: true, connectedTo: clientId, connectedInterface: cIface.name, connectionId: conn.id } : i) };
      return d;
    }));
  }, [devices]);

  const moveDevice = useCallback((id: string, x: number, y: number) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, x, y } : d));
  }, []);

  const toggleDeviceStatus = useCallback((id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: d.status === 'up' ? 'down' : 'up' } : d));
  }, []);

  const updateDevice = useCallback((updated: Device) => {
    setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
  }, []);

  const connectDevices = useCallback((fromId: string, toId: string, fromIfaceName?: string, toIfaceName?: string) => {
    const fromDevice = devices.find(d => d.id === fromId);
    const toDevice = devices.find(d => d.id === toId);
    if (!fromDevice || !toDevice) return;

    const fromIface = fromIfaceName
      ? fromDevice.interfaces.find(i => i.name === fromIfaceName && !i.connected)
      : fromDevice.interfaces.find(i => !i.connected);
    const toIface = toIfaceName
      ? toDevice.interfaces.find(i => i.name === toIfaceName && !i.connected)
      : toDevice.interfaces.find(i => !i.connected);
    if (!fromIface || !toIface) return;

    connectionCounter++;
    const isWireless = fromIface.isWireless || toIface.isWireless;
    const conn: Connection = {
      id: `conn-${connectionCounter}`,
      from: fromId,
      to: toId,
      fromInterface: fromIface.name,
      toInterface: toIface.name,
      type: isWireless ? 'wireless' : 'wired',
    };

    setConnections(prev => [...prev, conn]);
    setDevices(prev => prev.map(d => {
      if (d.id === fromId) {
        return { ...d, interfaces: d.interfaces.map(i => i.name === fromIface.name ? { ...i, connected: true, connectedTo: toId, connectedInterface: toIface.name, connectionId: conn.id } : i) };
      }
      if (d.id === toId) {
        return { ...d, interfaces: d.interfaces.map(i => i.name === toIface.name ? { ...i, connected: true, connectedTo: fromId, connectedInterface: fromIface.name, connectionId: conn.id } : i) };
      }
      return d;
    }));
    trackEvent('connection_made');
  }, [devices]);

  const startConnection = useCallback((deviceId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(deviceId);
    } else {
      setConnectingFrom(null);
    }
  }, [connectingFrom, connectDevices]);

  const completeConnection = useCallback((toId: string, fromIface?: string, toIface?: string) => {
    if (connectingFrom && connectingFrom !== toId) {
      connectDevices(connectingFrom, toId, fromIface, toIface);
    }
    setConnectingFrom(null);
  }, [connectingFrom, connectDevices]);

  const runPingSimulation = useCallback((fromId: string, toId: string) => {
    const conn = connections.find(c =>
      (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );
    if (!conn) return;

    const fromDevice = devices.find(d => d.id === fromId);
    const toDevice = devices.find(d => d.id === toId);
    if (!fromDevice || !toDevice) return;

    const packet: Packet = {
      id: `pkt-${Date.now()}`,
      sourceIp: fromDevice.interfaces[0]?.ip || '10.0.1.1',
      destIp: toDevice.interfaces[0]?.ip || '10.0.1.2',
      ttl: 64,
      protocol: 'ICMP',
      progress: 0,
      connectionId: conn.id,
      direction: conn.from === fromId ? 'forward' : 'reverse',
    };

    setPackets(prev => [...prev, packet]);

    // Animate packet
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      if (progress >= 100) {
        clearInterval(interval);
        setPackets(prev => prev.filter(p => p.id !== packet.id));
        // Send reply
        const reply: Packet = {
          ...packet,
          id: `pkt-${Date.now()}-reply`,
          sourceIp: packet.destIp,
          destIp: packet.sourceIp,
          direction: packet.direction === 'forward' ? 'reverse' : 'forward',
          progress: 0,
        };
        setPackets(prev => [...prev, reply]);
        let replyProgress = 0;
        const replyInterval = setInterval(() => {
          replyProgress += 2;
          if (replyProgress >= 100) {
            clearInterval(replyInterval);
            setPackets(prev => prev.filter(p => p.id !== reply.id));
          } else {
            setPackets(prev => prev.map(p => p.id === reply.id ? { ...p, progress: replyProgress } : p));
          }
        }, 30);
      } else {
        setPackets(prev => prev.map(p => p.id === packet.id ? { ...p, progress } : p));
      }
    }, 30);
  }, [connections, devices]);

  const startDrag = useCallback((deviceId: string, mouseX: number, mouseY: number) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      dragOffset.current = { x: mouseX - device.x, y: mouseY - device.y };
      setDragging(deviceId);
    }
  }, [devices]);

  const onDrag = useCallback((mouseX: number, mouseY: number) => {
    if (dragging) {
      moveDevice(dragging, mouseX - dragOffset.current.x, mouseY - dragOffset.current.y);
    }
  }, [dragging, moveDevice]);

  const endDrag = useCallback(() => {
    setDragging(null);
  }, []);

  const handleCommand = useCallback((deviceId: string, command: string): string => {
    return `% Unknown command: "${command}"`;
  }, []);

  // Save/load from localStorage
  const saveTopology = useCallback(() => {
    const name = prompt('Lab name:', `Lab ${new Date().toLocaleString()}`);
    if (!name) return;
    const lab: SavedLab = {
      id: `lab-${Date.now()}`,
      name,
      timestamp: Date.now(),
      devices,
      connections,
    };
    const existing = JSON.parse(localStorage.getItem(LABS_KEY) || '[]') as SavedLab[];
    existing.push(lab);
    localStorage.setItem(LABS_KEY, JSON.stringify(existing));
    trackEvent('topology_saved', { devices: devices.length });
  }, [devices, connections]);

  const loadTopology = useCallback(() => {
    const existing = JSON.parse(localStorage.getItem(LABS_KEY) || '[]') as SavedLab[];
    if (existing.length === 0) {
      alert('No saved labs found.');
      return;
    }
    const name = prompt(`Saved labs:\n${existing.map((l, i) => `${i + 1}. ${l.name}`).join('\n')}\n\nEnter number to load:`);
    if (!name) return;
    const idx = parseInt(name) - 1;
    if (idx >= 0 && idx < existing.length) {
      setDevices(existing[idx].devices);
      setConnections(existing[idx].connections);
      // Restore counters
      const maxDevId = existing[idx].devices.reduce((m, d) => {
        const n = parseInt(d.id.replace('device-', ''));
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      const maxConnId = existing[idx].connections.reduce((m, c) => {
        const n = parseInt(c.id.replace('conn-', ''));
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      deviceCounter = maxDevId;
      connectionCounter = maxConnId;
    }
  }, []);

  const clearWorkspace = useCallback(() => {
    setDevices([]);
    setConnections([]);
    setPackets([]);
    setSelectedDevice(null);
    setConnectingFrom(null);
    deviceCounter = 0;
    connectionCounter = 0;
    localStorage.removeItem(WORKSPACE_KEY);
  }, []);

  return {
    devices,
    connections,
    packets,
    selectedDevice,
    connectingFrom,
    dragging,
    setSelectedDevice,
    addDevice,
    removeDevice,
    removeConnection,
    connectWireless,
    moveDevice,
    toggleDeviceStatus,
    startConnection,
    completeConnection,
    updateDevice,
    runPingSimulation,
    startDrag,
    onDrag,
    endDrag,
    handleCommand,
    saveTopology,
    loadTopology,
    clearWorkspace,
  };
}