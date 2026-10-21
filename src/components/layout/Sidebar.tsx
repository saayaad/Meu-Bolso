import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  Wallet,
  Target,
  FolderTree,
  BarChart3,
  FileSpreadsheet,
  Users,
  UserCircle,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME } from '../../lib/constants';
import { isDevicePinSet } from '../../lib/security';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLockApp: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onLockApp }) => {
  const { currentUser, userProfile, logout } = useAuth();

  const displayName =
    userProfile?.name && userProfile.name !== 'Usuário'
      ? userProfile.name
      : currentUser?.displayName ||
        (currentUser?.email ? currentUser.email.split('@')[0] : 'Usuário');

  const displayEmail = userProfile?.email || currentUser?.email || '';
  const displayPhoto = userProfile?.photoURL || currentUser?.photoURL || null;
  const pinConfigured = isDevicePinSet();

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'transactions', label: 'Lançamentos', icon: Receipt },
    { id: 'payables', label: 'Contas a Pagar / Receber', icon: CalendarDays },
    { id: 'accounts', label: 'Contas & Cartões', icon: Wallet },
    { id: 'budgets', label: 'Orçamentos & Metas', icon: Target },
    { id: 'categories', label: 'Categorias', icon: FolderTree },
    { id: 'reports', label: 'Relatórios & Insights', icon: BarChart3 },
    { id: 'importexport', label: 'Importação / Exportação', icon: FileSpreadsheet },
    { id: 'sharing', label: 'Compartilhamento & Família', icon: Users },
    { id: 'profile', label: 'Meu Perfil', icon: UserCircle },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[var(--bg-card)] border-r border-[var(--border-color)] h-screen sticky top-0 shrink-0 transition-colors duration-200">
      {/* Brand */}
      <div className="p-6 border-b border-[var(--border-color)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#D97757] flex items-center justify-center text-[#0A0A0A] font-extrabold text-base shadow-md">
          MB
        </div>
        <div>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight">{APP_NAME}</h1>
          <p className="text-[11px] text-[var(--text-secondary)]">Gestão Financeira</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#D97757] text-[#0A0A0A] shadow-sm font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0A0A0A]' : 'text-[var(--text-secondary)]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile & Actions */}
      <div className="p-3 border-t border-[var(--border-color)] space-y-2">
        <button
          onClick={onLockApp}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[#D97757] hover:bg-[var(--bg-elevated)] rounded-xl transition-colors"
          title={pinConfigured ? 'Bloquear tela com PIN' : 'Configurar um PIN de segurança'}
        >
          <ShieldCheck className="w-4 h-4 text-[#D97757]" />
          <span>{pinConfigured ? 'Bloquear com PIN' : 'Bloquear com PIN (Configurar)'}</span>
        </button>

        <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] hover:border-[#D97757]/50 transition-colors">
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
            title="Abrir Meu Perfil"
          >
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#D97757]/40"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#D97757]/20 text-[#D97757] font-bold text-xs flex items-center justify-center shrink-0">
                {(displayName?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
              <p className="text-[10px] text-[var(--text-secondary)] truncate">
                {displayEmail || 'Editar perfil'}
              </p>
            </div>
          </button>

          <button
            onClick={() => logout()}
            title="Sair da conta"
            className="p-1.5 text-[var(--text-secondary)] hover:text-[#F87171] transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};