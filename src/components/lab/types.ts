export type DeviceType = 'router' | 'switch' | 'pc' | 'firewall' | 'server';

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  x: number;
  y: number;
  status: 'up' | 'down';
  interfaces: NetworkInterface[];
  config: string[];
}

export interface NetworkInterface {
  name: string;
  ip?: string;
  mask?: string;
  connected: boolean;
  connectedTo?: string;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromInterface: string;
  toInterface: string;
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

export interface LabScenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  devices: Device[];
  connections: Connection[];
  objectives: string[];
}

export const DEVICE_DEFAULTS: Record<DeviceType, { interfaces: string[]; icon: string }> = {
  router: { interfaces: ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2'], icon: 'router' },
  switch: { interfaces: ['FastEthernet0/1', 'FastEthernet0/2', 'FastEthernet0/3', 'FastEthernet0/4'], icon: 'switch' },
  pc: { interfaces: ['Ethernet0'], icon: 'pc' },
  firewall: { interfaces: ['inside', 'outside', 'dmz'], icon: 'firewall' },
  server: { interfaces: ['Ethernet0'], icon: 'server' },
};