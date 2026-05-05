import { useState, useCallback, useRef } from 'react';
import type { Device, Connection, Packet, DeviceType } from './types';
import { DEVICE_DEFAULTS } from './types';

let deviceCounter = 0;
let connectionCounter = 0;

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
    })),
    config: [],
  };
}

export function useLabState() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const addDevice = useCallback((type: DeviceType, x: number, y: number) => {
    const device = createDevice(type, x, y);
    setDevices(prev => [...prev, device]);
    return device;
  }, []);

  const removeDevice = useCallback((id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selectedDevice === id) setSelectedDevice(null);
  }, [selectedDevice]);

  const moveDevice = useCallback((id: string, x: number, y: number) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, x, y } : d));
  }, []);

  const toggleDeviceStatus = useCallback((id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, status: d.status === 'up' ? 'down' : 'up' } : d));
  }, []);

  const connectDevices = useCallback((fromId: string, toId: string) => {
    const fromDevice = devices.find(d => d.id === fromId);
    const toDevice = devices.find(d => d.id === toId);
    if (!fromDevice || !toDevice) return;

    const fromIface = fromDevice.interfaces.find(i => !i.connected);
    const toIface = toDevice.interfaces.find(i => !i.connected);
    if (!fromIface || !toIface) return;

    connectionCounter++;
    const conn: Connection = {
      id: `conn-${connectionCounter}`,
      from: fromId,
      to: toId,
      fromInterface: fromIface.name,
      toInterface: toIface.name,
    };

    setConnections(prev => [...prev, conn]);
    setDevices(prev => prev.map(d => {
      if (d.id === fromId) {
        return { ...d, interfaces: d.interfaces.map(i => i.name === fromIface.name ? { ...i, connected: true, connectedTo: toId } : i) };
      }
      if (d.id === toId) {
        return { ...d, interfaces: d.interfaces.map(i => i.name === toIface.name ? { ...i, connected: true, connectedTo: fromId } : i) };
      }
      return d;
    }));
  }, [devices]);

  const startConnection = useCallback((deviceId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(deviceId);
    } else if (connectingFrom !== deviceId) {
      connectDevices(connectingFrom, deviceId);
      setConnectingFrom(null);
    } else {
      setConnectingFrom(null);
    }
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
    const data = { devices, connections };
    localStorage.setItem('netsim-topology', JSON.stringify(data));
  }, [devices, connections]);

  const loadTopology = useCallback(() => {
    const raw = localStorage.getItem('netsim-topology');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setDevices(data.devices || []);
        setConnections(data.connections || []);
      } catch {}
    }
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
    moveDevice,
    toggleDeviceStatus,
    startConnection,
    runPingSimulation,
    startDrag,
    onDrag,
    endDrag,
    handleCommand,
    saveTopology,
    loadTopology,
  };
}