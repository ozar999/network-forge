import React, { useEffect, useRef, useState } from 'react';
import type { Device, Connection } from './types';
import { TerminalPanel } from './TerminalPanel';
import { DeviceIconMap } from './DeviceIcons';
import type { PingResult } from './PingResultPopup';

interface FloatingTerminalProps {
  devices: Device[];
  openIds: string[];
  activeId: string | null;
  expanded: boolean;
  allDevices: Device[];
  connections: Connection[];
  onCommand: (deviceId: string, command: string) => string;
  onUpdateDevice: (device: Device) => void;
  onPingResult: (r: PingResult) => void;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onToggleExpanded: () => void;
  onMinimize: () => void;
}

export function FloatingTerminal({
  devices, openIds, activeId, expanded,
  allDevices, connections, onCommand, onUpdateDevice, onPingResult,
  onFocus, onClose, onToggleExpanded, onMinimize,
}: FloatingTerminalProps) {
  const [height, setHeight] = useState(280);
  const resizing = useRef<{ startY: number; startH: number } | null>(null);

  // Escape collapses
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        onMinimize();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onMinimize]);

  // Drag-resize
  useEffect(() => {
    if (!resizing.current) return;
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const dy = resizing.current.startY - e.clientY;
      const next = Math.min(400, Math.max(120, resizing.current.startH + dy));
      setHeight(next);
    };
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  });

  if (openIds.length === 0) return null;

  const activeDev = devices.find(d => d.id === activeId) || null;
  const visibleTabs = openIds.slice(0, 8);

  return (
    <>
      {expanded && activeDev && (
        <div
          className="absolute left-0 right-0 bg-card border-t border-border shadow-2xl z-30 flex flex-col"
          style={{ bottom: 40, height }}
        >
          {/* Resize handle */}
          <div
            className="h-1 cursor-ns-resize bg-border hover:bg-terminal/60 transition-colors"
            onMouseDown={(e) => { resizing.current = { startY: e.clientY, startH: height }; }}
          />
          {/* Header */}
          <div className="h-9 px-3 flex items-center justify-between border-b border-border bg-secondary/40 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <DeviceBadge device={activeDev} />
              <span className="font-display text-terminal tracking-wider">{activeDev.hostname || activeDev.name}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{activeDev.type}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onMinimize}
                className="w-6 h-6 rounded hover:bg-accent text-muted-foreground hover:text-foreground text-xs flex items-center justify-center"
                title="Minimize (Esc)"
              >─</button>
              <button
                onClick={() => onClose(activeDev.id)}
                className="w-6 h-6 rounded hover:bg-noc-red/20 text-muted-foreground hover:text-noc-red text-xs flex items-center justify-center"
                title="Close terminal"
              >✕</button>
            </div>
          </div>
          {/* Body — TerminalPanel handles CLI for any device type */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <TerminalPanel
              device={activeDev}
              onCommand={onCommand}
              allDevices={allDevices}
              connections={connections}
              onUpdateDevice={onUpdateDevice}
              onPingResult={onPingResult}
            />
          </div>
        </div>
      )}

      {/* Bottom tab bar — always visible when any tab open */}
      <div className="absolute left-0 right-0 bottom-0 h-10 bg-card border-t border-border z-30 flex items-stretch overflow-x-auto">
        {visibleTabs.map(id => {
          const dev = devices.find(d => d.id === id);
          if (!dev) return null;
          const isActive = id === activeId && expanded;
          const Icon = DeviceIconMap[dev.type];
          return (
            <div
              key={id}
              className={`flex items-center gap-1.5 px-2 max-w-40 border-r border-border cursor-pointer transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-secondary border-l-2 border-l-terminal'
                  : 'hover:bg-accent border-l-2 border-l-transparent'
              }`}
              onClick={() => { onFocus(id); if (!expanded || activeId !== id) onToggleExpanded(); }}
            >
              {Icon && <div className="w-4 h-4 flex-shrink-0"><Icon className="w-4 h-4" status={dev.status} /></div>}
              <span className="text-xs text-foreground truncate">{dev.hostname || dev.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(id); }}
                className="ml-1 w-4 h-4 rounded hover:bg-noc-red/30 text-muted-foreground hover:text-noc-red text-[10px] flex items-center justify-center flex-shrink-0"
                title="Close"
              >✕</button>
            </div>
          );
        })}
        {openIds.length > visibleTabs.length && (
          <div className="px-2 flex items-center text-[10px] text-muted-foreground">+{openIds.length - visibleTabs.length}</div>
        )}
      </div>
    </>
  );
}

function DeviceBadge({ device }: { device: Device }) {
  const Icon = DeviceIconMap[device.type];
  if (!Icon) return null;
  return <div className="w-5 h-5"><Icon className="w-5 h-5" status={device.status} /></div>;
}