import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Database, CheckCircle, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useWorkspace } from '../../contexts/WorkspaceContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lastSyncTime, pendingOfflineCount } = useWorkspace();
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      // Just reconnected
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Notice when connection is restored
  if (showRestoredNotice && isOnline) {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 bg-[#141414] border border-[#4ADE80]/50 rounded-2xl shadow-2xl text-xs font-semibold text-[#4ADE80] animate-in fade-in slide-in-from-top-4 duration-300">
        <CheckCircle className="w-4 h-4 text-[#4ADE80] shrink-0" />
        <span>Conexão restabelecida! Dados sincronizados com a nuvem.</span>
      </div>
    );
  }

  // Banner when offline
  if (!isOnline) {
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-4 py-2 bg-[#1C1C1C] border border-[#FBBF24]/50 rounded-2xl shadow-2xl text-xs font-semibold text-[#FBBF24] animate-in fade-in slide-in-from-top-4 duration-300 max-w-[92vw]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FBBF24] animate-pulse shrink-0" />
          <WifiOff className="w-4 h-4 text-[#FBBF24] shrink-0" />
          <span>Modo Offline — Visualizando transações e dados em cache</span>
        </div>

        {(lastSyncTime || pendingOfflineCount > 0) && (
          <div className="flex items-center gap-2 text-[11px] text-[#A3A3A3] border-t sm:border-t-0 sm:border-l border-[#2B2B2B] pt-1 sm:pt-0 sm:pl-2.5">
            {lastSyncTime && (
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-[#A3A3A3]" />
                Cache de: {lastSyncTime}
              </span>
            )}
            {pendingOfflineCount > 0 && (
              <span className="text-[#D97757] font-bold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {pendingOfflineCount} pendente{pendingOfflineCount > 1 ? 's' : ''} de envio
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};
