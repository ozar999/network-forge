import React, { useRef, useCallback } from 'react';
import type { Device, Connection, Packet, DeviceType } from './types';
import { DeviceIconMap } from './DeviceIcons';

interface TopologyCanvasProps {
  devices: Device[];
  connections: Connection[];
  packets: Packet[];
  selectedDevice: string | null;
  connectingFrom: string | null;
  onSelectDevice: (id: string) => void;
  onStartConnection: (id: string) => void;
  onStartDrag: (id: string, x: number, y: number) => void;
  onDrag: (x: number, y: number) => void;
  onEndDrag: () => void;
  onAddDevice: (type: DeviceType, x: number, y: number) => void;
  onToggleStatus: (id: string) => void;
  onRemoveDevice: (id: string) => void;
  onPing: (fromId: string, toId: string) => void;
  onDoubleClick?: (id: string) => void;
}

export function TopologyCanvas({
  devices,
  connections,
  packets,
  selectedDevice,
  connectingFrom,
  onSelectDevice,
  onStartConnection,
  onStartDrag,
  onDrag,
  onEndDrag,
  onAddDevice,
  onToggleStatus,
  onRemoveDevice,
  onPing,
  onDoubleClick,
}: TopologyCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; deviceId: string } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onDrag(e.clientX - rect.left, e.clientY - rect.top);
  }, [onDrag]);

  const handleMouseUp = useCallback(() => {
    onEndDrag();
  }, [onEndDrag]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('device-type') as DeviceType;
    if (!type) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onAddDevice(type, e.clientX - rect.left - 32, e.clientY - rect.top - 32);
  }, [onAddDevice]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, deviceId });
  }, []);

  const getDeviceCenter = (device: Device) => ({
    x: device.x + 32,
    y: device.y + 32,
  });

  const getPacketPosition = (packet: Packet) => {
    const conn = connections.find(c => c.id === packet.connectionId);
    if (!conn) return null;
    const fromDevice = devices.find(d => d.id === conn.from);
    const toDevice = devices.find(d => d.id === conn.to);
    if (!fromDevice || !toDevice) return null;

    const from = getDeviceCenter(packet.direction === 'forward' ? fromDevice : toDevice);
    const to = getDeviceCenter(packet.direction === 'forward' ? toDevice : fromDevice);
    const t = packet.progress / 100;

    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  };

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 noc-grid overflow-hidden cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => { setContextMenu(null); }}
    >
      {/* SVG layer for connections and packets */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {connections.map(conn => {
          const from = devices.find(d => d.id === conn.from);
          const to = devices.find(d => d.id === conn.to);
          if (!from || !to) return null;
          const fc = getDeviceCenter(from);
          const tc = getDeviceCenter(to);
          return (
            <line
              key={conn.id}
              x1={fc.x}
              y1={fc.y}
              x2={tc.x}
              y2={tc.y}
              stroke="var(--terminal-dim)"
              strokeWidth="2"
              strokeDasharray="6 3"
            />
          );
        })}
        {/* Packets */}
        {packets.map(pkt => {
          const pos = getPacketPosition(pkt);
          if (!pos) return null;
          return (
            <g key={pkt.id}>
              <circle cx={pos.x} cy={pos.y} r="6" fill="var(--terminal-bright)" opacity="0.9" />
              <circle cx={pos.x} cy={pos.y} r="10" fill="none" stroke="var(--terminal)" strokeWidth="1" opacity="0.5">
                <animate attributeName="r" from="6" to="16" dur="0.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.5" to="0" dur="0.6s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Devices */}
      {devices.map(device => {
        const IconComp = DeviceIconMap[device.type];
        const isSelected = selectedDevice === device.id;
        const isConnecting = connectingFrom === device.id;
        return (
          <div
            key={device.id}
            className={`absolute flex flex-col items-center cursor-grab active:cursor-grabbing select-none transition-shadow duration-200 ${
              isSelected ? 'z-20' : 'z-10'
            }`}
            style={{ left: device.x, top: device.y }}
            onMouseDown={(e) => {
              if (e.button === 0) {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) onStartDrag(device.id, e.clientX - rect.left, e.clientY - rect.top);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectDevice(device.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick?.(device.id);
            }}
            onContextMenu={(e) => handleContextMenu(e, device.id)}
          >
            <div className={`relative w-16 h-16 rounded-lg border transition-all duration-200 ${
              isSelected
                ? 'border-terminal bg-terminal/10 shadow-[0_0_20px_var(--terminal)]'
                : isConnecting
                  ? 'border-noc-cyan bg-noc-cyan/10 shadow-[0_0_12px_var(--noc-cyan)]'
                  : 'border-border bg-secondary/50 hover:border-terminal/50'
            }`}>
              {IconComp && <IconComp className="w-full h-full p-1" status={device.status} />}
              {/* Status dot */}
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-background ${
                device.status === 'up' ? 'bg-terminal status-pulse' : 'bg-noc-red'
              }`} style={{ color: device.status === 'up' ? 'var(--terminal)' : 'var(--noc-red)' }} />
            </div>
            <span className="text-[10px] mt-1 text-foreground font-medium truncate max-w-20 text-center">
              {device.name}
            </span>
          </div>
        );
      })}

      {/* Packet info overlay */}
      {packets.length > 0 && (
        <div className="absolute top-3 right-3 bg-card/90 border border-border rounded px-3 py-2 text-[10px] space-y-1 z-30 backdrop-blur-sm">
          <div className="text-terminal-bright font-semibold mb-1">📦 Packet In Transit</div>
          {packets.map(pkt => (
            <div key={pkt.id} className="text-muted-foreground">
              <span className="text-terminal">{pkt.sourceIp}</span>
              <span className="mx-1">→</span>
              <span className="text-noc-cyan">{pkt.destIp}</span>
              <span className="ml-2 text-muted-foreground">TTL:{pkt.ttl} {pkt.protocol}</span>
            </div>
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="absolute bg-card border border-border rounded shadow-lg py-1 z-50 min-w-36"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); onStartConnection(contextMenu.deviceId); setContextMenu(null); }}
          >
            {connectingFrom ? '🔗 Connect Here' : '🔗 Start Connection'}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleStatus(contextMenu.deviceId); setContextMenu(null); }}
          >
            ⚡ Toggle Status
          </button>
          {selectedDevice && selectedDevice !== contextMenu.deviceId && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
              onClick={(e) => { e.stopPropagation(); onPing(selectedDevice, contextMenu.deviceId); setContextMenu(null); }}
            >
              📡 Ping from Selected
            </button>
          )}
          <hr className="border-border my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-noc-red hover:bg-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); onRemoveDevice(contextMenu.deviceId); setContextMenu(null); }}
          >
            🗑️ Delete Device
          </button>
        </div>
      )}

      {/* Empty state */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-display text-glow phosphor-flicker">DRAG DEVICES HERE</p>
            <p className="text-xs mt-2 opacity-60">Drag devices from the toolbar above onto the canvas</p>
            <p className="text-xs mt-1 opacity-40">Right-click devices to connect • Click to configure</p>
          </div>
        </div>
      )}
    </div>
  );
}