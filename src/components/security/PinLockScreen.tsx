import React, { useState } from 'react';
import { Lock, AlertCircle, LogOut } from 'lucide-react';
import { verifyDevicePin, getDevicePinLength } from '../../lib/security';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME } from '../../lib/constants';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const { logout } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const targetPinLength = getDevicePinLength();

  const handleKeyPress = (num: string) => {
    if (isVerifying) return;
    if (pin.length < targetPinLength) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg('');
      if (nextPin.length === targetPinLength) {
        checkPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const checkPin = async (candidatePin: string) => {
    setIsVerifying(true);
    const result = await verifyDevicePin(candidatePin);
    setIsVerifying(false);

    if (result.success) {
      onUnlock();
    } else {
      setPin('');
      if (result.exceededAttempts) {
        alert('Limite de 5 tentativas excedido por segurança. Faça login novamente.');
        await logout();
      } else {
        setErrorMsg(`PIN incorreto. Restam ${result.remainingAttempts} tentativas.`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-xs w-full space-y-6 flex flex-col items-center">
        {/* Logo and Lock icon */}
        <div className="w-16 h-16 rounded-3xl bg-[#D97757] text-[#0A0A0A] flex items-center justify-center font-bold text-2xl shadow-xl">
          <Lock className="w-8 h-8 stroke-[2.5]" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5]">{APP_NAME} Protegido</h2>
          <p className="text-xs text-[#A3A3A3] mt-1">
            Digite seu PIN de {targetPinLength} dígitos para desbloquear
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex items-center gap-3 py-2">
          {Array.from({ length: targetPinLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'bg-[#D97757] border-[#D97757] scale-110'
                  : 'bg-transparent border-[#2B2B2B]'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <div className="text-xs text-[#F87171] font-semibold flex items-center gap-1.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric keypad (3x4 grid) */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
            <button
              key={n}
              onClick={() => handleKeyPress(n)}
              disabled={isVerifying}
              className="h-16 rounded-2xl bg-[#141414] hover:bg-[#1C1C1C] active:bg-[#D97757] active:text-[#0A0A0A] text-xl font-bold text-[#F5F5F5] border border-[#2B2B2B] transition-all flex items-center justify-center shadow-sm"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            disabled={isVerifying}
            className="h-16 rounded-2xl bg-[#141414] hover:bg-[#1C1C1C] active:bg-[#D97757] active:text-[#0A0A0A] text-xl font-bold text-[#F5F5F5] border border-[#2B2B2B] transition-all flex items-center justify-center shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={isVerifying}
            className="h-16 rounded-2xl bg-[#141414] hover:bg-[#1C1C1C] text-xs font-semibold text-[#A3A3A3] hover:text-[#F87171] border border-[#2B2B2B] transition-all flex items-center justify-center"
          >
            Apagar
          </button>
        </div>

        {/* Emergency Logout */}
        <button
          onClick={() => logout()}
          className="text-xs text-[#A3A3A3] hover:text-[#F87171] flex items-center gap-1.5 pt-4 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Esqueci o PIN (Sair da conta)</span>
        </button>
      </div>
    </div>
  );
};