import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D97757]/15 hover:bg-[#D97757]/25 text-[#D97757] border border-[#D97757]/30 text-xs font-semibold transition-all active:scale-95"
        title="Instalar Meu Bolso como aplicativo"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#A3A3A3] hover:text-[#F5F5F5] border border-[#2B2B2B] text-xs font-medium transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#D97757]" />
          <span className="hidden sm:inline">Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] p-6 shadow-2xl text-left space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
                <h3 className="text-base font-bold text-[#F5F5F5]">Instalar no iPhone / iPad</h3>
                <button onClick={() => setShowIOSGuide(false)} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[#A3A3A3] leading-relaxed">
                Para instalar o <strong>Meu Bolso</strong> na sua tela de início sem precisar da App Store:
              </p>
              <div className="p-3 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs space-y-2">
                <p className="flex items-center gap-2 text-[#F5F5F5]">
                  <span className="w-5 h-5 rounded-full bg-[#D97757] text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                  <span>Toque no botão de <strong>Compartilhar</strong> na barra do Safari.</span>
                </p>
                <p className="flex items-center gap-2 text-[#F5F5F5]">
                  <span className="w-5 h-5 rounded-full bg-[#D97757] text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                  <span>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#D97757] text-[#0A0A0A] font-bold text-xs"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
