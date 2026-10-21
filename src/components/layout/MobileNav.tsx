import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  CalendarDays,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMoreMenu: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMoreMenu,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'transactions', label: 'Lançamentos', icon: Receipt },
    { id: 'payables', label: 'A Pagar', icon: CalendarDays },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-lg border-t border-[#2B2B2B] px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {tabs.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] rounded-xl transition-all ${
                isActive ? 'text-[#D97757]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={onOpenMoreMenu}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] rounded-xl transition-all ${
            ['accounts', 'budgets', 'categories', 'importexport', 'sharing', 'settings'].includes(activeTab)
              ? 'text-[#D97757]'
              : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </div>
    </nav>
  );
};
