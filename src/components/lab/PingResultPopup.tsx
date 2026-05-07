import React from 'react';

export interface PingResult {
  sourceDevice: string;
  sourceIp: string;
  destIp: string;
  success: boolean;
  reason?: string;
}

interface PingResultPopupProps {
  result: PingResult;
  onClose: () => void;
  onAskAi?: () => void;
}

export function PingResultPopup({ result, onClose, onAskAi }: PingResultPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-5 min-w-80 max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-display text-terminal">PING RESULT</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Source:</span>
            <span className="text-foreground font-mono">{result.sourceDevice} ({result.sourceIp})</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Destination:</span>
            <span className="text-foreground font-mono">{result.destIp}</span>
          </div>
        </div>

        <div className={`rounded p-3 mb-4 border ${
          result.success
            ? 'bg-terminal/5 border-terminal/30'
            : 'bg-noc-red/5 border-noc-red/30'
        }`}>
          <div className={`text-sm font-display mb-1 ${result.success ? 'text-terminal' : 'text-noc-red'}`}>
            {result.success ? '✓ SUCCESS' : '✗ FAILED'}
          </div>
          <div className={`text-lg font-mono tracking-wider ${result.success ? 'text-terminal' : 'text-noc-red'}`}>
            {result.success ? '!!!!!' : 'U.U.U.U.U'}
          </div>
          {result.reason && !result.success && (
            <div className="text-[10px] text-noc-red/80 mt-2 leading-relaxed">
              {result.reason}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            Close
          </button>
          {!result.success && onAskAi && (
            <button onClick={onAskAi} className="flex-1 px-3 py-1.5 text-xs rounded border border-noc-cyan text-noc-cyan hover:bg-noc-cyan/10 transition-colors">
              🤖 Ask AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
}