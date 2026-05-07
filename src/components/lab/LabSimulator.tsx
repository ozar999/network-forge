import React from 'react';
import { useState } from 'react';
import { TopologyCanvas } from './TopologyCanvas';
import { TerminalPanel } from './TerminalPanel';
import { DeviceToolbar } from './DeviceToolbar';
import { useLabState } from './useLabState';
import { InterfaceSelectModal } from './InterfaceSelectModal';
import { DeviceDesktop } from './DeviceDesktop';
import { PingResultPopup, type PingResult } from './PingResultPopup';
import type { Device } from './types';
import { useNavigate } from '@tanstack/react-router';

export function LabSimulator() {
  const lab = useLabState();
  const selectedDev = lab.devices.find(d => d.id === lab.selectedDevice) || null;
  const [interfaceModal, setInterfaceModal] = useState<{ device: Device; step: 'from' | 'to'; fromIface?: string } | null>(null);
  const [desktopDevice, setDesktopDevice] = useState<Device | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const navigate = useNavigate();

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

  const handleDoubleClick = (deviceId: string) => {
    const device = lab.devices.find(d => d.id === deviceId);
    if (device && device.type !== 'router' && device.type !== 'switch' && device.type !== 'firewall') {
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
      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopologyCanvas
            devices={lab.devices}
            connections={lab.connections}
            packets={lab.packets}
            selectedDevice={lab.selectedDevice}
            connectingFrom={lab.connectingFrom}
            onSelectDevice={lab.setSelectedDevice}
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
        </div>
        {/* Terminal panel */}
        <div className="w-96 border-l border-border bg-card/50 flex flex-col">
          <TerminalPanel
            device={selectedDev}
            onCommand={lab.handleCommand}
            allDevices={lab.devices}
            connections={lab.connections}
            onUpdateDevice={lab.updateDevice}
            onPingResult={handlePingResult}
          />
        </div>
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