import React from 'react';
import { useState } from 'react';
import { TopologyCanvas } from './TopologyCanvas';
import { FloatingTerminal } from './FloatingTerminal';
import { DeviceToolbar } from './DeviceToolbar';
import { useLabState } from './useLabState';
import { InterfaceSelectModal } from './InterfaceSelectModal';
import { DeviceDesktop } from './DeviceDesktop';
import { PingResultPopup, type PingResult } from './PingResultPopup';
import { DeviceConfigPanel } from './DeviceConfigPanel';
import type { Device } from './types';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/progress';

export function LabSimulator() {
  const lab = useLabState();
  useEffect(() => { trackEvent('lab_open'); }, []);
  const [interfaceModal, setInterfaceModal] = useState<{ device: Device; step: 'from' | 'to'; fromIface?: string } | null>(null);
  const [desktopDevice, setDesktopDevice] = useState<Device | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  // Floating terminal tabs
  const [openTerminalIds, setOpenTerminalIds] = useState<string[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const navigate = useNavigate();

  const openTerminal = (deviceId: string, expand: boolean) => {
    setOpenTerminalIds(prev => prev.includes(deviceId) ? prev : [...prev, deviceId]);
    setActiveTerminalId(deviceId);
    lab.setSelectedDevice(deviceId);
    if (expand) setTerminalExpanded(true);
  };

  const closeTerminal = (deviceId: string) => {
    setOpenTerminalIds(prev => {
      const next = prev.filter(id => id !== deviceId);
      if (activeTerminalId === deviceId) {
        const newActive = next[next.length - 1] || null;
        setActiveTerminalId(newActive);
        if (!newActive) setTerminalExpanded(false);
      }
      return next;
    });
  };

  const handleStartConnection = (deviceId: string) => {
    if (lab.connectingFrom === null) {
      const device = lab.devices.find(d => d.id === deviceId);
      if (device) {
        const available = device.interfaces.filter(i => !i.connected);
        if (available.length === 1) {
          lab.startConnection(deviceId);
        } else if (available.length > 1) {
          setInterfaceModal({ device, step: 'from' });
          lab.startConnection(deviceId);
        }
      }
    } else {
      const device = lab.devices.find(d => d.id === deviceId);
      if (device) {
        const available = device.interfaces.filter(i => !i.connected);
        if (available.length <= 1) {
          lab.completeConnection(deviceId);
        } else {
          setInterfaceModal({ device, step: 'to' });
        }
      }
    }
  };

  const handleInterfaceSelect = (ifaceName: string) => {
    if (!interfaceModal) return;
    if (interfaceModal.step === 'from') {
      setInterfaceModal(null);
    } else {
      lab.completeConnection(interfaceModal.device.id, undefined, ifaceName);
      setInterfaceModal(null);
    }
  };

  const handleSelectDevice = (deviceId: string) => {
    lab.setSelectedDevice(deviceId);
    // Open the right-side config panel; terminal opens on double-click or Console button
    setConfigPanelOpen(true);
  };

  const handleDoubleClick = (deviceId: string) => {
    const device = lab.devices.find(d => d.id === deviceId);
    if (!device) return;
    // For PC/laptop/server/AP: open desktop GUI. For network gear: expand terminal.
    if (device.type === 'router' || device.type === 'switch' || device.type === 'firewall') {
      openTerminal(deviceId, true);
    } else {
      setDesktopDevice(device);
    }
  };

  const handlePingResult = (result: PingResult) => {
    setPingResult(result);
  };

  const handleAskAi = () => {
    if (pingResult) {
      const msg = `Ping from ${pingResult.sourceDevice} (${pingResult.sourceIp}) to ${pingResult.destIp} failed. Reason: ${pingResult.reason || 'Unknown'}. Help me fix this.`;
      localStorage.setItem('netsem_ai_context', msg);
      navigate({ to: '/ai-assistant' });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] scanlines">
      <DeviceToolbar
        onSave={lab.saveTopology}
        onLoad={lab.loadTopology}
        onClear={lab.clearWorkspace}
        connectingFrom={lab.connectingFrom}
        deviceCount={lab.devices.length}
        connectionCount={lab.connections.length}
      />
      <div className="relative flex-1 min-h-0">
        {/* Empty-state hint */}
        {lab.devices.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="text-center px-6 py-8 rounded-2xl border border-dashed border-terminal/30 bg-card/40 backdrop-blur-sm max-w-md">
              <div className="text-3xl mb-2">🧪</div>
              <h3 className="text-sm font-display text-terminal tracking-wider mb-1">EMPTY LAB</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag a device from the top toolbar onto the canvas to begin.<br />
                Click two devices in turn to link them, double-click any device for its CLI or desktop.
              </p>
            </div>
          </div>
        )}
        {/* Full-width canvas */}
          <TopologyCanvas
            devices={lab.devices}
            connections={lab.connections}
            packets={lab.packets}
            selectedDevice={lab.selectedDevice}
            connectingFrom={lab.connectingFrom}
            onSelectDevice={handleSelectDevice}
            onStartConnection={handleStartConnection}
            onStartDrag={lab.startDrag}
            onDrag={lab.onDrag}
            onEndDrag={lab.endDrag}
            onAddDevice={lab.addDevice}
            onToggleStatus={lab.toggleDeviceStatus}
            onRemoveDevice={lab.removeDevice}
            onPing={lab.runPingSimulation}
            onDoubleClick={handleDoubleClick}
            onRenameDevice={(id, name) => {
              const dev = lab.devices.find(d => d.id === id);
              if (dev) lab.updateDevice({ ...dev, name, hostname: name });
            }}
          />

        {/* Floating terminal drawer + tab bar — overlays canvas, doesn't push it */}
        <FloatingTerminal
          devices={lab.devices}
          openIds={openTerminalIds}
          activeId={activeTerminalId}
          expanded={terminalExpanded}
          allDevices={lab.devices}
          connections={lab.connections}
          onCommand={lab.handleCommand}
          onUpdateDevice={lab.updateDevice}
          onPingResult={handlePingResult}
          onFocus={(id) => { setActiveTerminalId(id); lab.setSelectedDevice(id); }}
          onClose={closeTerminal}
          onToggleExpanded={() => setTerminalExpanded(e => !e)}
          onMinimize={() => setTerminalExpanded(false)}
        />

        {/* Right-side device config panel */}
        {configPanelOpen && lab.selectedDevice && (() => {
          const dev = lab.devices.find(d => d.id === lab.selectedDevice);
          if (!dev) return null;
          return (
            <DeviceConfigPanel
              device={dev}
              connections={lab.connections}
              onClose={() => setConfigPanelOpen(false)}
              onUpdateDevice={lab.updateDevice}
              onOpenTerminal={(id) => openTerminal(id, true)}
              onRemoveConnection={lab.removeConnection}
            />
          );
        })()}
      </div>

      {interfaceModal && (
        <InterfaceSelectModal
          device={interfaceModal.device}
          title={interfaceModal.step === 'from' ? 'Select source interface' : 'Select target interface'}
          onSelect={handleInterfaceSelect}
          onClose={() => setInterfaceModal(null)}
        />
      )}

      {desktopDevice && (
        <DeviceDesktop
          device={desktopDevice}
          allDevices={lab.devices}
          connections={lab.connections}
          onUpdateDevice={(d) => { lab.updateDevice(d); setDesktopDevice(d); }}
          onClose={() => setDesktopDevice(null)}
          onLaunchTerminal={() => { openTerminal(desktopDevice.id, true); setDesktopDevice(null); }}
          onConnectWireless={lab.connectWireless}
          onDisconnect={lab.removeConnection}
        />
      )}

      {pingResult && (
        <PingResultPopup
          result={pingResult}
          onClose={() => setPingResult(null)}
          onAskAi={handleAskAi}
        />
      )}
    </div>
  );
}