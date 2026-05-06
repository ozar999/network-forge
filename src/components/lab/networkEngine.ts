import type { Device, Connection, RouteEntry, ArpEntry } from './types';
import { ipToInt, intToIpStr, getNetworkAddress, isInSameSubnet, generateMac } from './types';

export function findRoute(device: Device, destIp: string): RouteEntry | null {
  // Check connected routes first
  for (const iface of device.interfaces) {
    if (iface.ip && iface.mask && iface.status === 'up' && iface.connected) {
      if (isInSameSubnet(destIp, iface.ip, iface.mask)) {
        return {
          network: getNetworkAddress(iface.ip, iface.mask),
          mask: iface.mask,
          interface: iface.name,
          type: 'C',
        };
      }
    }
  }
  // Check static/dynamic routes
  for (const route of device.routingTable) {
    const net = ipToInt(route.network);
    const mask = ipToInt(route.mask);
    const dest = ipToInt(destIp);
    if ((dest & mask) === (net & mask)) {
      return route;
    }
  }
  // Default route
  if (device.defaultGateway) {
    return { network: '0.0.0.0', mask: '0.0.0.0', nextHop: device.defaultGateway, type: 'S' };
  }
  return null;
}

export function resolveArp(device: Device, ip: string): string | null {
  const entry = device.arpTable.find(a => a.ip === ip);
  return entry?.mac ?? null;
}

export function simulatePing(
  sourceDevice: Device,
  destIp: string,
  allDevices: Device[],
  connections: Connection[],
): { success: boolean; output: string; hops: string[] } {
  const hops: string[] = [];

  // Check if source has an IP
  const sourceIp = sourceDevice.interfaces.find(i => i.ip)?.ip;
  if (!sourceIp) {
    return { success: false, output: `% Source has no IP address configured`, hops };
  }

  // Check if pinging self
  if (sourceDevice.interfaces.some(i => i.ip === destIp)) {
    return {
      success: true,
      output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms`,
      hops: [sourceIp],
    };
  }

  // Find destination device
  const destDevice = allDevices.find(d => d.interfaces.some(i => i.ip === destIp));
  if (!destDevice) {
    return {
      success: false,
      output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`,
      hops,
    };
  }

  // Check connectivity path
  const path = findPath(sourceDevice.id, destDevice.id, allDevices, connections);
  if (!path) {
    return {
      success: false,
      output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`,
      hops,
    };
  }

  // Check all devices in path are up
  for (const devId of path) {
    const dev = allDevices.find(d => d.id === devId);
    if (dev?.status === 'down') {
      return {
        success: false,
        output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\nU.U..\nSuccess rate is 0 percent (0/5)`,
        hops,
      };
    }
  }

  const rtt = Math.floor(Math.random() * 5) + 1;
  return {
    success: true,
    output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = ${rtt}/${rtt + 1}/${rtt + 3} ms`,
    hops: path,
  };
}

export function simulateTraceroute(
  sourceDevice: Device,
  destIp: string,
  allDevices: Device[],
  connections: Connection[],
): string {
  const destDevice = allDevices.find(d => d.interfaces.some(i => i.ip === destIp));
  if (!destDevice) {
    return `Tracing route to ${destIp}\n  1  * * * Request timed out.\n  2  * * * Request timed out.\n  3  * * * Request timed out.\nTrace complete.`;
  }

  const path = findPath(sourceDevice.id, destDevice.id, allDevices, connections);
  if (!path || path.length === 0) {
    return `Tracing route to ${destIp}\n  1  * * * Request timed out.\nTrace complete.`;
  }

  let output = `Tracing route to ${destIp} over a maximum of 30 hops:\n\n`;
  path.forEach((devId, idx) => {
    const dev = allDevices.find(d => d.id === devId);
    const ip = dev?.interfaces.find(i => i.ip)?.ip || '*';
    const ms = Math.floor(Math.random() * 5) + 1;
    output += `  ${idx + 1}  ${ms} ms  ${ms + 1} ms  ${ms} ms  ${ip}\n`;
  });
  output += `\nTrace complete.`;
  return output;
}

function findPath(fromId: string, toId: string, devices: Device[], connections: Connection[]): string[] | null {
  const visited = new Set<string>();
  const queue: string[][] = [[fromId]];
  visited.add(fromId);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    if (current === toId) return path;

    const neighbors = getNeighbors(current, connections);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

function getNeighbors(deviceId: string, connections: Connection[]): string[] {
  const neighbors: string[] = [];
  for (const conn of connections) {
    if (conn.from === deviceId) neighbors.push(conn.to);
    if (conn.to === deviceId) neighbors.push(conn.from);
  }
  return neighbors;
}

export function generateConnectedRoutes(device: Device): RouteEntry[] {
  const routes: RouteEntry[] = [];
  for (const iface of device.interfaces) {
    if (iface.ip && iface.mask && iface.status === 'up') {
      routes.push({
        network: getNetworkAddress(iface.ip, iface.mask),
        mask: iface.mask,
        interface: iface.name,
        type: 'C',
      });
    }
  }
  return routes;
}