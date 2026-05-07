import React, { useRef, useCallback, useState, useEffect } from 'react';
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; deviceId: string } | null>(null);

  // Pan/zoom state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [showMinimap, setShowMinimap] = useState(true);

  // Convert screen coords to world coords
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: screenX, y: screenY };
    const sx = screenX - rect.left;
    const sy = screenY - rect.top;
    return {
      x: (sx - offset.x) / scale,
      y: (sy - offset.y) / scale,
    };
  }, [scale, offset]);

  // Zoom centered on cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.15), 5);
    const ratio = newScale / scale;
    setScale(newScale);
    setOffset(prev => ({
      x: mouseX - (mouseX - prev.x) * ratio,
      y: mouseY - (mouseY - prev.y) * ratio,
    }));
  }, [scale]);

  // Space key for pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.current.x + panStart.current.ox,
        y: e.clientY - panStart.current.y + panStart.current.oy,
      });
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY);
    onDrag(world.x, world.y);
  }, [onDrag, isPanning, screenToWorld]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    onEndDrag();
  }, [onEndDrag, isPanning]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle-click or space+left-click = pan
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }
  }, [spaceHeld, offset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('device-type') as DeviceType;
    if (!type) return;
    const world = screenToWorld(e.clientX, e.clientY);
    onAddDevice(type, world.x - 32, world.y - 32);
  }, [onAddDevice, screenToWorld]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, deviceId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, deviceId });
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

  const fitToScreen = useCallback(() => {
    if (devices.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const minX = Math.min(...devices.map(d => d.x));
    const minY = Math.min(...devices.map(d => d.y));
    const maxX = Math.max(...devices.map(d => d.x + 64));
    const maxY = Math.max(...devices.map(d => d.y + 64));
    const w = maxX - minX + 100;
    const h = maxY - minY + 100;
    const newScale = Math.min(rect.width / w, rect.height / h, 2);
    setScale(newScale);
    setOffset({
      x: (rect.width - w * newScale) / 2 - minX * newScale + 50 * newScale,
      y: (rect.height - h * newScale) / 2 - minY * newScale + 50 * newScale,
    });
  }, [devices]);

  // Minimap dimensions
  const minimapW = 160;
  const minimapH = 100;
  const getMinimapTransform = () => {
    if (devices.length === 0) return { scale: 1, ox: 0, oy: 0 };
    const pad = 40;
    const minX = Math.min(...devices.map(d => d.x)) - pad;
    const minY = Math.min(...devices.map(d => d.y)) - pad;
    const maxX = Math.max(...devices.map(d => d.x + 64)) + pad;
    const maxY = Math.max(...devices.map(d => d.y + 64)) + pad;
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const s = Math.min(minimapW / w, minimapH / h);
    return { scale: s, ox: -minX * s, oy: -minY * s };
  };

  return (
    <div
      ref={canvasRef}
      className={`relative flex-1 overflow-hidden ${isPanning || spaceHeld ? 'cursor-grab' : 'cursor-crosshair'}`}
      style={{ userSelect: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onWheel={handleWheel}
      onClick={() => { setContextMenu(null); }}
    >
      {/* Dot grid background that moves with pan/zoom */}
      <div
        className="absolute inset-0 noc-dot-grid pointer-events-none"
        style={{
          backgroundPosition: `${offset.x % (30 * scale)}px ${offset.y % (30 * scale)}px`,
          backgroundSize: `${30 * scale}px ${30 * scale}px`,
        }}
      />

      {/* Transformed world layer */}
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          inset: 0,
          width: 0,
          height: 0,
          overflow: 'visible',
        }}
      >
        {/* SVG layer for connections and packets */}
        <svg className="absolute pointer-events-none" style={{ zIndex: 1, left: 0, top: 0, width: '10000px', height: '10000px', overflow: 'visible' }}>
          {connections.map(conn => {
            const from = devices.find(d => d.id === conn.from);
            const to = devices.find(d => d.id === conn.to);
            if (!from || !to) return null;
            const fc = getDeviceCenter(from);
            const tc = getDeviceCenter(to);
            const isWireless = conn.type === 'wireless';
            return (
              <line
                key={conn.id}
                x1={fc.x}
                y1={fc.y}
                x2={tc.x}
                y2={tc.y}
                stroke={isWireless ? 'var(--noc-cyan)' : 'var(--terminal-dim)'}
                strokeWidth="2"
                strokeDasharray={isWireless ? '8 4' : '6 3'}
                opacity={isWireless ? 0.7 : 1}
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
              className={`absolute flex flex-col items-center select-none transition-shadow duration-200 ${
                isSelected ? 'z-20' : 'z-10'
              } ${spaceHeld || isPanning ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
              style={{ left: device.x, top: device.y }}
              onMouseDown={(e) => {
                if (e.button === 0 && !spaceHeld) {
                  e.stopPropagation();
                  const world = screenToWorld(e.clientX, e.clientY);
                  onStartDrag(device.id, world.x, world.y);
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
      </div>

      {/* Packet info overlay */}
      {packets.length > 0 && (
        <div className="absolute top-3 right-3 bg-card/90 border border-border rounded px-3 py-2 text-[10px] space-y-1 z-40 backdrop-blur-sm">
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
          className="fixed bg-card border border-border rounded shadow-lg py-1 z-50 min-w-36"
          style={{ left: contextMenu.x, top: contextMenu.y}}
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

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-40">
        {showMinimap && devices.length > 0 && (
          <div className="bg-card/90 border border-border rounded mb-1 backdrop-blur-sm overflow-hidden" style={{ width: minimapW, height: minimapH }}>
            <svg width={minimapW} height={minimapH}>
              {(() => {
                const mt = getMinimapTransform();
                return (
                  <g transform={`translate(${mt.ox},${mt.oy}) scale(${mt.scale})`}>
                    {connections.map(conn => {
                      const from = devices.find(d => d.id === conn.from);
                      const to = devices.find(d => d.id === conn.to);
                      if (!from || !to) return null;
                      const fc = getDeviceCenter(from);
                      const tc = getDeviceCenter(to);
                      return <line key={conn.id} x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y} stroke="var(--terminal-dim)" strokeWidth={2 / mt.scale} />;
                    })}
                    {devices.map(d => (
                      <rect
                        key={d.id}
                        x={d.x}
                        y={d.y}
                        width={64}
                        height={64}
                        fill={d.id === selectedDevice ? 'var(--terminal)' : 'var(--terminal-dim)'}
                        opacity={0.8}
                        rx={4}
                      />
                    ))}
                  </g>
                );
              })()}
            </svg>
          </div>
        )}
        <div className="flex gap-1">
          <button onClick={() => setScale(s => Math.min(s * 1.2, 5))} className="w-7 h-7 bg-card/90 border border-border rounded text-foreground hover:bg-accent text-xs flex items-center justify-center" title="Zoom in">+</button>
          <button onClick={() => setScale(s => Math.max(s * 0.8, 0.15))} className="w-7 h-7 bg-card/90 border border-border rounded text-foreground hover:bg-accent text-xs flex items-center justify-center" title="Zoom out">−</button>
          <button onClick={fitToScreen} className="h-7 px-2 bg-card/90 border border-border rounded text-foreground hover:bg-accent text-[9px] flex items-center justify-center" title="Fit to screen">FIT</button>
          <button onClick={() => setShowMinimap(p => !p)} className="w-7 h-7 bg-card/90 border border-border rounded text-foreground hover:bg-accent text-[9px] flex items-center justify-center" title="Toggle minimap">M</button>
        </div>
        <div className="text-[9px] text-muted-foreground text-center">{Math.round(scale * 100)}%</div>
      </div>

      {/* Empty state */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-display text-glow phosphor-flicker">DRAG DEVICES HERE</p>
            <p className="text-xs mt-2 opacity-60">Drag devices from the toolbar above onto the canvas</p>
            <p className="text-xs mt-1 opacity-40">Right-click devices to connect • Double-click to open GUI • Scroll to zoom • Space+drag to pan</p>
          </div>
        </div>
      )}
    </div>
  );
}