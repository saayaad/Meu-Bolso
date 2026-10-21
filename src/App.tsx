import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { MobileFAB } from './components/layout/MobileFAB';
import { MobileMoreDrawer } from './components/layout/MobileMoreDrawer';
import { TransactionModal } from './components/transactions/TransactionModal';
import { PinLockScreen } from './components/security/PinLockScreen';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { OfflineIndicator } from './components/ui/OfflineIndicator';

// Pages
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { PayablesReceivablesPage } from './pages/PayablesReceivablesPage';
import { AccountsPage } from './pages/AccountsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { BudgetsGoalsPage } from './pages/BudgetsGoalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ImportExportPage } from './pages/ImportExportPage';
import { SharingPage } from './pages/SharingPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LegalPage } from './pages/LegalPage';

import { Transaction, TransactionType } from './types';
import { isDevicePinSet } from './lib/security';

function MainApp() {
  const { currentUser, userProfile, loading, updateUserProfileData } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const [showLegal, setShowLegal] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Security Lock State
  const [isLocked, setIsLocked] = useState<boolean>(isDevicePinSet());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza o tema claro/escuro global no HTML
  useEffect(() => {
    const currentTheme = userProfile?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.body.classList.remove('light');
    }
  }, [userProfile?.theme]);

  // Exibe o tutorial APENAS se o onboarding nunca foi concluído por este usuário
  useEffect(() => {
    if (!currentUser || loading) return;

    const localKey = `meu_bolso_onboarding_done_${currentUser.uid}`;
    const alreadyDoneLocally = localStorage.getItem(localKey) === 'true';

    if (alreadyDoneLocally || userProfile?.onboardingDone === true) {
      if (!alreadyDoneLocally) {
        localStorage.setItem(localKey, 'true');
      }
      setShowTutorial(false);
      return;
    }

    // Só exibe se expressamente false após terminar o carregamento completo do perfil
    if (userProfile && userProfile.onboardingDone === false && !alreadyDoneLocally) {
      setShowTutorial(true);
    }
  }, [currentUser, userProfile?.onboardingDone, loading]);

  // Handle inactivity timeout and background app lock
  useEffect(() => {
    if (!userProfile?.security?.pinEnabled || !isDevicePinSet()) {
      return;
    }

    const lockMinutes = userProfile?.security?.autoLockMinutes || 5;
    const timeoutMs = lockMinutes * 60 * 1000;

    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        setIsLocked(true);
      }, timeoutMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsLocked(true);
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userProfile?.security?.pinEnabled, userProfile?.security?.autoLockMinutes]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#D97757] flex items-center justify-center text-[#0A0A0A] font-extrabold text-xl animate-pulse">
          MB
        </div>
        <p className="text-xs text-[var(--text-secondary)] font-medium tracking-wide">Carregando Meu Bolso...</p>
      </div>
    );
  }

  // Not authenticated
  if (!currentUser) {
    if (showLegal) {
      return <LegalPage onBack={() => setShowLegal(false)} />;
    }
    return <AuthPage onOpenLegal={() => setShowLegal(true)} />;
  }

  // App Locked with PIN
  if (isLocked && isDevicePinSet()) {
    return <PinLockScreen onUnlock={() => setIsLocked(false)} />;
  }

  const handleOpenTransactionModal = (
    type: TransactionType = 'expense',
    editTx: Transaction | null = null
  ) => {
    setTxModalType(type);
    setEditingTx(editTx);
    setIsTxModalOpen(true);
  };

  const handleCloseTutorial = async () => {
    setShowTutorial(false);
    if (currentUser) {
      localStorage.setItem(`meu_bolso_onboarding_done_${currentUser.uid}`, 'true');
    }
    if (userProfile && userProfile.onboardingDone !== true) {
      await updateUserProfileData({ onboardingDone: true });
    }
  };

  const handleLockApp = () => {
    if (isDevicePinSet()) {
      setIsLocked(true);
    } else {
      setActiveTab('profile');
      setShowLegal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col lg:flex-row antialiased transition-colors duration-200">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={tab => {
          setActiveTab(tab);
          setShowLegal(false);
        }}
        onLockApp={handleLockApp}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8 bg-[var(--bg-main)]">
        {/* Offline Indicator Banner */}
        <OfflineIndicator />

        {/* Top Header */}
        <Header
          onOpenTransactionModal={handleOpenTransactionModal}
          onNavigateTab={setActiveTab}
        />

        {/* Tab Routing */}
        <main className="flex-1 bg-[var(--bg-main)]">
          {activeTab === 'dashboard' && (
            <DashboardPage
              onOpenTransactionModal={handleOpenTransactionModal}
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsPage onOpenTransactionModal={handleOpenTransactionModal} />
          )}
          {activeTab === 'payables' && (
            <PayablesReceivablesPage onOpenTransactionModal={handleOpenTransactionModal} />
          )}
          {activeTab === 'accounts' && (
            <AccountsPage onOpenTransactionModal={handleOpenTransactionModal} />
          )}
          {activeTab === 'budgets' && <BudgetsGoalsPage />}
          {activeTab === 'categories' && <CategoriesPage />}
          {activeTab === 'reports' && <ReportsPage />}
          {activeTab === 'importexport' && <ImportExportPage />}
          {activeTab === 'sharing' && <SharingPage />}
          {activeTab === 'profile' && (
            <ProfilePage onLockNow={() => isDevicePinSet() && setIsLocked(true)} />
          )}
          {activeTab === 'settings' && (
            <SettingsPage
              onShowTutorial={() => setShowTutorial(true)}
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === 'legal' && <LegalPage onBack={() => setActiveTab('settings')} />}
        </main>

        {/* Mobile Floating Action Button */}
        <MobileFAB onOpenTransactionModal={handleOpenTransactionModal} />

        {/* Mobile Bottom Navigation */}
        <MobileNav
          activeTab={activeTab}
          onSelectTab={tab => {
            setActiveTab(tab);
            setShowLegal(false);
          }}
          onOpenMoreMenu={() => setIsMoreOpen(true)}
        />

        {/* Mobile More Drawer */}
        <MobileMoreDrawer
          isOpen={isMoreOpen}
          onClose={() => setIsMoreOpen(false)}
          onSelectTab={tab => {
            setActiveTab(tab);
            setShowLegal(false);
          }}
          onLockApp={handleLockApp}
        />
      </div>

      {/* Global Transaction Modal */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        initialType={txModalType}
        editingTransaction={editingTx}
      />

      {/* Onboarding Tutorial Modal */}
      <OnboardingModal isOpen={showTutorial} onClose={handleCloseTutorial} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <MainApp />
      </WorkspaceProvider>
    </AuthProvider>
  );
}