import React from 'react';
import { TopologyCanvas } from './TopologyCanvas';
import { TerminalPanel } from './TerminalPanel';
import { DeviceToolbar } from './DeviceToolbar';
import { useLabState } from './useLabState';

export function LabSimulator() {
  const lab = useLabState();
  const selectedDev = lab.devices.find(d => d.id === lab.selectedDevice) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] scanlines">
      <DeviceToolbar
        onSave={lab.saveTopology}
        onLoad={lab.loadTopology}
        onClear={() => window.location.reload()}
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
            onStartConnection={lab.startConnection}
            onStartDrag={lab.startDrag}
            onDrag={lab.onDrag}
            onEndDrag={lab.endDrag}
            onAddDevice={lab.addDevice}
            onToggleStatus={lab.toggleDeviceStatus}
            onRemoveDevice={lab.removeDevice}
            onPing={lab.runPingSimulation}
          />
        </div>
        {/* Terminal panel */}
        <div className="w-96 border-l border-border bg-card/50 flex flex-col">
          <TerminalPanel device={selectedDev} onCommand={lab.handleCommand} />
        </div>
      </div>
    </div>
  );
}