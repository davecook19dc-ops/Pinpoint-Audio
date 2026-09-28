import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Laptop,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  ArrowRightLeft,
  X,
  Wifi,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Send,
  Database,
} from 'lucide-react';
import { syncService, SyncStatus, SyncProgress } from '../services/syncService';
import { generateQrSvgPath } from '../utils/qrCode';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted: () => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({ isOpen, onClose, onSyncCompleted }) => {
  const [activeTab, setActiveTab] = useState<'host' | 'client'>('host');
  const [hostPairingCode, setHostPairingCode] = useState<string>('');
  const [clientInputCode, setClientInputCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Select an action to start WebRTC P2P sync.');
  const [progress, setProgress] = useState<SyncProgress | undefined>(undefined);
  const [isTransferring, setIsTransferring] = useState(false);

  // Initialize Host Mode when Host tab is selected
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'host') {
      startHostSession();
    } else {
      syncService.destroy();
      setStatus('idle');
      setStatusMessage('Enter the Pairing Code displayed on your host device.');
    }

    return () => {
      // Don't destroy if tab changes while actively connected, but clean up on modal close
    };
  }, [isOpen, activeTab]);

  const startHostSession = () => {
    const { pairingCode } = syncService.startHost(
      undefined,
      (newStatus, msg, prog) => {
        setStatus(newStatus);
        setStatusMessage(msg);
        if (prog) setProgress(prog);
        if (newStatus === 'transferring') setIsTransferring(true);
        if (newStatus === 'success' || newStatus === 'error') setIsTransferring(false);
      },
      () => {
        onSyncCompleted();
      }
    );
    setHostPairingCode(pairingCode);
  };

  const handleConnectClient = () => {
    if (!clientInputCode.trim()) return;
    setIsTransferring(false);
    setProgress(undefined);

    syncService.connectToHost(
      clientInputCode,
      (newStatus, msg, prog) => {
        setStatus(newStatus);
        setStatusMessage(msg);
        if (prog) setProgress(prog);
        if (newStatus === 'transferring') setIsTransferring(true);
        if (newStatus === 'success' || newStatus === 'error') setIsTransferring(false);
      },
      () => {
        onSyncCompleted();
      }
    );
  };

  const handleSendLibrary = async () => {
    setIsTransferring(true);
    await syncService.sendLocalLibrary((curr, total, stage) => {
      setProgress({ current: curr, total, stage });
    });
  };

  const copyToClipboard = () => {
    if (!hostPairingCode) return;
    navigator.clipboard.writeText(hostPairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  const qrSvgPath = hostPairingCode ? generateQrSvgPath(hostPairingCode, 21) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-[#e8e4dc] dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e8e4dc] dark:border-stone-800 flex items-center justify-between bg-[#faf8f5] dark:bg-stone-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span>P2P Device Sync</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800/80">
                  WebRTC Direct
                </span>
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Direct device-to-device merge with zero cloud servers
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              syncService.destroy();
              onClose();
            }}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-4 border-b border-[#e8e4dc] dark:border-stone-800 bg-[#f7f5f0]/50 dark:bg-stone-900/40">
          <div className="grid grid-cols-2 gap-2 bg-[#e8e4dc]/60 dark:bg-stone-800/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('host')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'host'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 text-indigo-500" />
              <span>Host / Show Code</span>
            </button>

            <button
              onClick={() => setActiveTab('client')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'client'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-2xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Connect / Enter Code</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'host' ? (
            /* HOST VIEW */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Pairing Code
                </span>
                <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto">
                  Type this code on your secondary device to establish a direct WebRTC channel.
                </p>
              </div>

              {/* Code Display Box */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 bg-[#fbf9f6] dark:bg-stone-950/60 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl shadow-inner">
                {/* SVG Visual Matrix Preview */}
                {qrSvgPath && (
                  <div className="w-20 h-20 p-1.5 bg-white rounded-xl shadow-xs shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 21 21" className="w-full h-full fill-stone-900">
                      <path d={qrSvgPath} />
                    </svg>
                  </div>
                )}

                <div className="flex flex-col items-center sm:items-start space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-black text-indigo-700 dark:text-indigo-400 tracking-wider select-all">
                      {hostPairingCode || 'VOCAL-....'}
                    </span>

                    <button
                      onClick={copyToClipboard}
                      className="p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer shadow-2xs"
                      title="Copy pairing code"
                    >
                      {copiedCode ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    <span>Waiting for client device connection...</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={startHostSession}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Code</span>
                </button>
              </div>
            </div>
          ) : (
            /* CLIENT VIEW */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Enter Pairing Code
                </span>
                <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto">
                  Type the 6-character Pairing Code shown on your host device.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
                <input
                  type="text"
                  value={clientInputCode}
                  onChange={(e) => setClientInputCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VOCAL-9K2X"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-base font-bold tracking-wider uppercase focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 shadow-2xs"
                />

                <button
                  onClick={handleConnectClient}
                  disabled={!clientInputCode.trim() || status === 'connecting' || isTransferring}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {status === 'connecting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Connect & Sync</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Connection & Sync Status Box */}
          <div
            className={`p-4 rounded-xl border space-y-2 transition-all ${
              status === 'success'
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : status === 'error'
                ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-500/30 text-rose-900 dark:text-rose-200'
                : status === 'connected' || status === 'transferring'
                ? 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
                : 'bg-stone-50 dark:bg-stone-950/40 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {status === 'connecting' || status === 'transferring' ? (
                <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0 mt-0.5" />
              ) : status === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : status === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              )}

              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-xs font-semibold block truncate">{statusMessage}</span>

                {progress && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span>{progress.stage}</span>
                      <span>
                        {progress.current} / {progress.total}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-200 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* If Connected, option to Push Local Library explicitly */}
            {status === 'connected' && (
              <div className="pt-2 border-t border-indigo-500/10 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                  Ready for peer data transmission
                </span>

                <button
                  onClick={handleSendLibrary}
                  disabled={isTransferring}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Push Local Library</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#e8e4dc] dark:border-stone-800 bg-[#f7f5f0] dark:bg-stone-950/50 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
          <span>Encrypted WebRTC DataChannel</span>
          <button
            onClick={() => {
              syncService.destroy();
              onClose();
            }}
            className="px-3 py-1 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
