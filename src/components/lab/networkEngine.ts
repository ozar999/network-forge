import type { Device, Connection, RouteEntry, ArpEntry, DnsRecord } from './types';
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
): { success: boolean; output: string; hops: string[]; reason?: string } {
  const hops: string[] = [];

  // Check if source has an IP
  const sourceIp = sourceDevice.interfaces.find(i => i.ip)?.ip;
  if (!sourceIp) {
    return { success: false, output: `% Source has no IP address configured`, hops, reason: 'No IP address configured on source device' };
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
      reason: `Destination ${destIp} not found on any device in the network`,
    };
  }

  // Check if destination interface is up
  const destIface = destDevice.interfaces.find(i => i.ip === destIp);
  if (destIface && destIface.status === 'down') {
    return {
      success: false,
      output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\nU.U..\nSuccess rate is 0 percent (0/5)`,
      hops,
      reason: `Destination interface ${destIface.name} is administratively down`,
    };
  }

  // Check source interface status
  const srcIface = sourceDevice.interfaces.find(i => i.ip === sourceIp);
  if (srcIface && srcIface.status === 'down') {
    return {
      success: false,
      output: `% Interface is down`,
      hops,
      reason: 'Source interface is administratively down',
    };
  }

  // Check subnet logic
  const srcMask = srcIface?.mask;
  if (srcMask && !isInSameSubnet(sourceIp, destIp, srcMask)) {
    // Different subnet — need gateway
    if (!sourceDevice.defaultGateway && sourceDevice.routingTable.length === 0 && sourceDevice.type !== 'router') {
      return {
        success: false,
        output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`,
        hops,
        reason: `Different subnet (${getNetworkAddress(sourceIp, srcMask)} vs ${destIp}), no default gateway configured`,
      };
    }
  }

  // Check connectivity path
  const path = findPath(sourceDevice.id, destDevice.id, allDevices, connections);
  if (!path) {
    return {
      success: false,
      output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`,
      hops,
      reason: 'No physical path exists between source and destination (no cable connection)',
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
        reason: `Device "${dev.name}" in the path is down`,
      };
    }
  }

  // VLAN isolation check for switches in path
  const srcVlan = srcIface?.vlan || 1;
  const destVlan = destIface?.vlan || 1;
  // Simple VLAN check: if both are on same switch with different VLANs, fail
  for (const devId of path) {
    const dev = allDevices.find(d => d.id === devId);
    if (dev?.type === 'switch') {
      // Check if source and dest connect to this switch with different VLANs
      const srcConn = connections.find(c =>
        (c.from === sourceDevice.id && c.to === devId) || (c.to === sourceDevice.id && c.from === devId)
      );
      const dstConn = connections.find(c =>
        (c.from === destDevice.id && c.to === devId) || (c.to === destDevice.id && c.from === devId)
      );
      if (srcConn && dstConn) {
        const swSrcIface = dev.interfaces.find(i =>
          i.name === (srcConn.from === devId ? srcConn.fromInterface : srcConn.toInterface)
        );
        const swDstIface = dev.interfaces.find(i =>
          i.name === (dstConn.from === devId ? dstConn.fromInterface : dstConn.toInterface)
        );
        const swSrcVlan = swSrcIface?.vlan || 1;
        const swDstVlan = swDstIface?.vlan || 1;
        if (swSrcVlan !== swDstVlan && swSrcIface?.switchportMode !== 'trunk' && swDstIface?.switchportMode !== 'trunk') {
          return {
            success: false,
            output: `Sending 5, 100-byte ICMP Echos to ${destIp}, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)`,
            hops,
            reason: `VLAN isolation: source is on VLAN ${swSrcVlan}, destination is on VLAN ${swDstVlan}. Inter-VLAN routing required.`,
          };
        }
      }
    }
  }

  // Populate ARP tables on success
  // (This mutates devices in-place for simplicity, caller should update state)

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

// DHCP simulation
export function simulateDhcp(
  client: Device,
  clientIface: string,
  allDevices: Device[],
  connections: Connection[],
): { success: boolean; ip?: string; mask?: string; gateway?: string; dns?: string; poolName?: string; serverName?: string } {
  // Find DHCP servers reachable from this client
  for (const server of allDevices) {
    if (server.id === client.id) continue;
    // Check if server has DHCP pools
    const pools = server.dhcpPools.filter(p => p.network && p.mask);
    if (pools.length === 0) continue;
    // Check if server has DHCP service enabled (for servers) or has pools (for routers)
    if (server.type === 'server' && !server.services.find(s => s.type === 'dhcp' && s.enabled)) continue;

    // Check connectivity
    const path = findPath(client.id, server.id, allDevices, connections);
    if (!path) continue;

    // Find a pool with available IPs
    for (const pool of pools) {
      const netInt = ipToInt(pool.network);
      const maskInt = ipToInt(pool.mask);
      const broadcast = (netInt | ~maskInt) >>> 0;
      // Simple: assign next IP after network address
      const usedIps = new Set(pool.leases.map(l => l.ip));
      for (let ip = netInt + 2; ip < broadcast; ip++) {
        const ipStr = intToIpStr(ip);
        if (usedIps.has(ipStr)) continue;
        if (pool.excludedAddresses.includes(ipStr)) continue;
        // Found available IP
        return {
          success: true,
          ip: ipStr,
          mask: pool.mask,
          gateway: pool.defaultRouter,
          dns: pool.dnsServer,
          poolName: pool.name,
          serverName: server.name,
        };
      }
    }
  }
  return { success: false };
}

// DNS resolution
export function resolveDns(
  hostname: string,
  dnsServerIp: string | undefined,
  allDevices: Device[],
): string | null {
  if (!dnsServerIp) return null;
  const dnsServer = allDevices.find(d => d.interfaces.some(i => i.ip === dnsServerIp));
  if (!dnsServer) return null;
  if (dnsServer.type === 'server' && !dnsServer.services.find(s => s.type === 'dns' && s.enabled)) return null;
  const records = dnsServer.dnsRecords || [];
  const aRecord = records.find(r => r.type === 'A' && r.hostname.toLowerCase() === hostname.toLowerCase());
  if (aRecord) return aRecord.value;
  const cnameRecord = records.find(r => r.type === 'CNAME' && r.hostname.toLowerCase() === hostname.toLowerCase());
  if (cnameRecord) {
    return resolveDns(cnameRecord.value, dnsServerIp, allDevices);
  }
  return null;
}