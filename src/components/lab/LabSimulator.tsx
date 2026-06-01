import React from 'react';
import { useState } from 'react';
import { TopologyCanvas } from './TopologyCanvas';
import { FloatingTerminal } from './FloatingTerminal';
import { DeviceToolbar } from './DeviceToolbar';
import { useLabState } from './useLabState';
import { InterfaceSelectModal } from './InterfaceSelectModal';
import { DeviceDesktop } from './DeviceDesktop';
import { PingResultPopup, type PingResult } from './PingResultPopup';
import type { Device } from './types';
import { useNavigate } from '@tanstack/react-router';

export function LabSimulator() {
  const lab = useLabState();
  const [interfaceModal, setInterfaceModal] = useState<{ device: Device; step: 'from' | 'to'; fromIface?: string } | null>(null);
  const [desktopDevice, setDesktopDevice] = useState<Device | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  // Floating terminal tabs
  const [openTerminalIds, setOpenTerminalIds] = useState<string[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [terminalExpanded, setTerminalExpanded] = useState(false);
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
    // Open or focus terminal tab (collapsed by default)
    openTerminal(deviceId, false);
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
      />
      <div className="relative flex-1 min-h-0">
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