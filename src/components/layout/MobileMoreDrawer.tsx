import React from 'react';
import {
  Wallet,
  Target,
  FolderTree,
  FileSpreadsheet,
  Users,
  UserCircle,
  Settings,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDevicePinSet } from '../../lib/security';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: string) => void;
  onLockApp: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onLockApp,
}) => {
  const { currentUser, userProfile, logout } = useAuth();

  if (!isOpen) return null;

  const displayName =
    userProfile?.name && userProfile.name !== 'Usuário'
      ? userProfile.name
      : currentUser?.displayName ||
        (currentUser?.email ? currentUser.email.split('@')[0] : 'Usuário');

  const displayEmail = userProfile?.email || currentUser?.email || '';
  const pinConfigured = isDevicePinSet();

  const items = [
    { id: 'profile', label: 'Meu Perfil', icon: UserCircle },
    { id: 'accounts', label: 'Contas & Cartões', icon: Wallet },
    { id: 'budgets', label: 'Orçamentos & Metas', icon: Target },
    { id: 'categories', label: 'Categorias & Subcategorias', icon: FolderTree },
    { id: 'importexport', label: 'Importação & Exportação', icon: FileSpreadsheet },
    { id: 'sharing', label: 'Compartilhamento & Família', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative bg-[#1C1C1C] border-t border-[#2B2B2B] rounded-t-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-[#2B2B2B]">
          <button
            type="button"
            onClick={() => {
              onSelectTab('profile');
              onClose();
            }}
            className="flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[#D97757]/20 text-[#D97757] font-bold text-sm flex items-center justify-center">
              {(displayName?.[0] || 'U').toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm text-[#F5F5F5]">{displayName}</p>
              <p className="text-xs text-[#A3A3A3]">{displayEmail}</p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-[#A3A3A3] hover:text-[#F5F5F5] rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-3 space-y-1">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold text-[#F5F5F5] hover:bg-[#2B2B2B] active:bg-[#2B2B2B] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#2B2B2B] flex items-center justify-center text-[#D97757]">
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#2B2B2B] space-y-2">
          <button
            onClick={() => {
              onClose();
              onLockApp();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A3A3A3] hover:text-[#D97757] transition-colors"
          >
            <ShieldCheck className="w-5 h-5 text-[#D97757]" />
            <span>{pinConfigured ? 'Bloquear App com PIN' : 'Configurar PIN de Bloqueio'}</span>
          </button>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#F87171] hover:bg-[#F87171]/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};