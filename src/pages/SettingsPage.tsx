import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Bell,
  Palette,
  FileText,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  Upload,
  HelpCircle,
  Database,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  RotateCcw,
  ArchiveRestore,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { CurrencyCode, ThemeMode } from '../types';
import { compressImage } from '../lib/images';
import { formatMoney } from '../lib/money';
import {
  setupDevicePin,
  removeDevicePin,
  isDevicePinSet,
  isBiometricsAvailable,
} from '../lib/security';
import { exportBackupJSON, exportReportToCSV } from '../lib/export';
import { saveOfflineSnapshot } from '../lib/offlineStorage';
import { APP_NAME } from '../lib/constants';

interface SettingsPageProps {
  onShowTutorial: () => void;
  onNavigateTab: (tab: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onShowTutorial, onNavigateTab }) => {
  const {
    currentUser,
    userProfile,
    updateUserProfileData,
    logout,
    resetPassword,
  } = useAuth();

  const {
    activeWorkspaceId,
    workspace,
    members,
    isOwner,
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    trashItems,
    clearAllWorkspaceData,
    restoreTrashItem,
    isOfflineMode,
    lastSyncTime,
    pendingOfflineCount,
  } = useWorkspace();

  const [isSyncingCache, setIsSyncingCache] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Profile Form States
  const [name, setName] = useState<string>(userProfile?.name || '');
  const [currency, setCurrency] = useState<CurrencyCode>(userProfile?.currency || 'BRL');
  const [theme, setTheme] = useState<ThemeMode>(userProfile?.theme || 'dark');
  const [photoPreview, setPhotoPreview] = useState<string | null>(userProfile?.photoURL || null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);

  // Security PIN States
  const [pinEnabled, setPinEnabled] = useState<boolean>(isDevicePinSet());
  const [pinInput, setPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<1 | 5 | 15>(
    userProfile?.security?.autoLockMinutes || 5
  );
  const [biometricsSupported, setBiometricsSupported] = useState<boolean>(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(
    userProfile?.security?.biometricsEnabled || false
  );

  // Notifications States
  const [daysBefore, setDaysBefore] = useState<1 | 3 | 7>(
    userProfile?.notificationSettings?.daysBefore || 3
  );
  const [browserNotifications, setBrowserNotifications] = useState<boolean>(
    userProfile?.notificationSettings?.browserNotifications || false
  );
  const [dailyReminder, setDailyReminder] = useState<boolean>(
    userProfile?.notificationSettings?.dailyReminder || false
  );
  const [dailyReminderTime, setDailyReminderTime] = useState<string>(
    userProfile?.notificationSettings?.dailyReminderTime || '20:00'
  );

  // Clear workspace / Trash modal
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearConfirmationText, setClearConfirmationText] = useState<string>('');
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [showTrashModal, setShowTrashModal] = useState<boolean>(false);

  // Delete account confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricsSupported);
  }, []);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setCurrency(userProfile.currency || 'BRL');
      setTheme(userProfile.theme || 'dark');
      setPhotoPreview(userProfile.photoURL || null);
      if (userProfile.security) {
        setAutoLockMinutes(userProfile.security.autoLockMinutes || 5);
        setBiometricsEnabled(userProfile.security.biometricsEnabled || false);
      }
      if (userProfile.notificationSettings) {
        setDaysBefore(userProfile.notificationSettings.daysBefore || 3);
        setBrowserNotifications(userProfile.notificationSettings.browserNotifications || false);
        setDailyReminder(userProfile.notificationSettings.dailyReminder || false);
        setDailyReminderTime(userProfile.notificationSettings.dailyReminderTime || '20:00');
      }
    }
  }, [userProfile]);

  const handleManualCacheSync = async () => {
    if (!activeWorkspaceId) return;
    setIsSyncingCache(true);
    setSyncStatusMsg(null);
    try {
      await saveOfflineSnapshot(activeWorkspaceId, {
        workspace,
        transactions,
        accounts,
        categories,
        budgets,
        goals,
      });
      setSyncStatusMsg('Cache offline atualizado com sucesso via Cache API!');
      setTimeout(() => setSyncStatusMsg(null), 3500);
    } catch {
      setSyncStatusMsg('Erro ao atualizar cache offline.');
    } finally {
      setIsSyncingCache(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateUserProfileData({
        name: name.trim(),
        currency,
        theme,
        photoURL: photoPreview,
      });
      setFeedback({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao atualizar perfil.' });
    }
  };

  const handleToggleTheme = async (newTheme: ThemeMode) => {
    setTheme(newTheme);
    try {
      await updateUserProfileData({ theme: newTheme });
      setFeedback({ type: 'success', text: `Tema alterado para ${newTheme === 'dark' ? 'Escuro' : 'Claro'}!` });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao salvar preferência de tema.' });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'A foto deve ter no máximo 5 MB.' });
      return;
    }

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, 512, 512, 0.85);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPhotoPreview(dataUrl);
        setIsCompressingPhoto(false);
      };
      reader.readAsDataURL(compressed);
    } catch {
      setIsCompressingPhoto(false);
      setFeedback({ type: 'error', text: 'Falha ao comprimir imagem.' });
    }
  };

  const handleSavePin = async () => {
    if (pinInput.length < 4 || pinInput.length > 6) {
      setFeedback({ type: 'error', text: 'O PIN deve ter de 4 a 6 dígitos numéricos.' });
      return;
    }
    if (pinInput !== confirmPinInput) {
      setFeedback({ type: 'error', text: 'Os PINs digitados não conferem.' });
      return;
    }

    const success = await setupDevicePin(pinInput);
    if (success) {
      setPinEnabled(true);
      setShowPinModal(false);
      setPinInput('');
      setConfirmPinInput('');
      await updateUserProfileData({
        security: {
          pinEnabled: true,
          autoLockMinutes,
          biometricsEnabled,
        },
      });
      setFeedback({ type: 'success', text: 'PIN de segurança configurado com sucesso!' });
    }
  };

  const handleDisablePin = async () => {
    removeDevicePin();
    setPinEnabled(false);
    await updateUserProfileData({
      security: {
        pinEnabled: false,
        autoLockMinutes,
        biometricsEnabled: false,
      },
    });
    setFeedback({ type: 'success', text: 'Bloqueio por PIN desativado neste dispositivo.' });
  };

  const handleToggleBrowserNotifications = async (enabled: boolean) => {
    if (enabled && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setFeedback({
          type: 'error',
          text: 'Permissão de notificações não concedida no navegador.',
        });
        setBrowserNotifications(false);
        return;
      }
    }
    setBrowserNotifications(enabled);
    await updateUserProfileData({
      notificationSettings: {
        daysBefore,
        browserNotifications: enabled,
        dailyReminder,
        dailyReminderTime,
      },
    });
  };

  const handleExportDataCSV = () => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0);
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amountCents, 0);

    exportReportToCSV({
      title: 'Exportação Completa de Dados - Meu Bolso',
      periodText: 'Histórico Geral',
      transactions,
      categories,
      accounts,
      summary: {
        totalIncomeCents: totalIncome,
        totalExpenseCents: totalExpense,
        balanceCents: totalIncome - totalExpense,
      },
    });
  };

  const handleClearAllData = async () => {
    if (clearConfirmationText !== 'LIMPAR') {
      setFeedback({ type: 'error', text: 'Digite "LIMPAR" em maiúsculas para confirmar.' });
      return;
    }

    setIsClearing(true);
    try {
      await clearAllWorkspaceData();
      setFeedback({ type: 'success', text: 'Todos os dados foram limpos e movidos para a lixeira com sucesso!' });
      setClearConfirmationText('');
      setShowClearModal(false);
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao limpar dados do workspace.' });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'EXCLUIR') {
      setFeedback({ type: 'error', text: 'Digite "EXCLUIR" em maiúsculas para confirmar.' });
      return;
    }

    if (isOwner && members.length > 1) {
      setFeedback({
        type: 'error',
        text: 'Você é proprietário de um workspace com outros membros. Remova os membros antes de excluir sua conta.',
      });
      setShowDeleteModal(false);
      return;
    }

    setIsDeleting(true);
    try {
      await clearAllWorkspaceData();
      if (currentUser) {
        await currentUser.delete();
      }
      await logout();
      alert('Sua conta e seus dados foram excluídos com sucesso.');
      window.location.reload();
    } catch {
      setFeedback({
        type: 'error',
        text: 'Por segurança, faça login novamente antes de prosseguir com a exclusão da conta.',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const totalTrashCount = 
    (trashItems.accounts?.length || 0) +
    (trashItems.categories?.length || 0) +
    (trashItems.transactions?.length || 0) +
    (trashItems.budgets?.length || 0) +
    (trashItems.goals?.length || 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-[#F5F5F5]">Configurações</h2>
        <p className="text-xs text-[#A3A3A3]">
          Personalize seu perfil, moeda, segurança, notificações e privacidade
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            feedback.type === 'success'
              ? 'bg-[#141414] border-[#4ADE80]/50 text-[#4ADE80]'
              : 'bg-[#141414] border-[#F87171]/50 text-[#F87171]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
            ✕
          </button>
        </div>
      )}

      {/* 1. Perfil */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#2B2B2B]">
          <User className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm text-[#F5F5F5]">Perfil do Usuário</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar upload */}
          <div className="relative group shrink-0">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-[#D97757]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#1C1C1C] border border-[#2B2B2B] flex items-center justify-center text-[#D97757] font-bold text-2xl">
                {(name?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-[10px]">
              <Upload className="w-4 h-4 mb-0.5" />
              <span>{isCompressingPhoto ? '...' : 'Alterar'}</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">E-mail</label>
                <input
                  type="email"
                  disabled
                  value={currentUser?.email || ''}
                  className="w-full px-3.5 py-2 bg-[#1C1C1C]/60 border border-[#2B2B2B] rounded-xl text-xs text-[#A3A3A3] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Moeda Principal
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as CurrencyCode)}
                  className="w-full px-3.5 py-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5]"
                >
                  <option value="BRL">Real Brasileiro (R$ - BRL)</option>
                  <option value="USD">Dólar Americano ($ - USD)</option>
                  <option value="EUR">Euro (€ - EUR)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfile}
                className="px-5 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Preferências e Tema */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#2B2B2B]">
          <Palette className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm text-[#F5F5F5]">Aparência e Tema</h3>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-[#1C1C1C] rounded-2xl">
          <div>
            <p className="text-xs font-bold text-[#F5F5F5]">Esquema de Cores</p>
            <p className="text-[11px] text-[#A3A3A3]">
              O tema escuro padrão é otimizado para contraste e economia de energia.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleToggleTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                theme === 'dark'
                  ? 'bg-[#D97757] text-[#0A0A0A]'
                  : 'bg-[#141414] text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Escuro</span>
            </button>
            <button
              onClick={() => handleToggleTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                theme === 'light'
                  ? 'bg-[#D97757] text-[#0A0A0A]'
                  : 'bg-[#141414] text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Claro</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Segurança e PIN */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#2B2B2B]">
          <Shield className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm text-[#F5F5F5]">Segurança e Bloqueio com PIN</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-[#1C1C1C] rounded-2xl">
            <div>
              <p className="text-xs font-bold text-[#F5F5F5]">Bloqueio do App por PIN</p>
              <p className="text-[11px] text-[#A3A3A3]">
                Proteja seus dados com PIN de 4 a 6 dígitos (armazenado com hash PBKDF2 via Web Crypto).
              </p>
            </div>
            {pinEnabled ? (
              <button
                onClick={handleDisablePin}
                className="px-3 py-1.5 bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30 rounded-xl text-xs font-semibold"
              >
                Desativar PIN
              </button>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="px-3.5 py-1.5 bg-[#D97757] text-[#0A0A0A] font-bold text-xs rounded-xl"
              >
                Ativar PIN
              </button>
            )}
          </div>

          {pinEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Tempo para Auto-bloqueio
                </label>
                <select
                  value={autoLockMinutes}
                  onChange={async e => {
                    const mins = parseInt(e.target.value, 10) as 1 | 5 | 15;
                    setAutoLockMinutes(mins);
                    await updateUserProfileData({
                      security: {
                        pinEnabled: true,
                        autoLockMinutes: mins,
                        biometricsEnabled,
                      },
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5]"
                >
                  <option value={1}>1 minuto de inatividade</option>
                  <option value={5}>5 minutos de inatividade</option>
                  <option value={15}>15 minutos de inatividade</option>
                </select>
              </div>

              {biometricsSupported && (
                <div className="flex items-center justify-between p-3 bg-[#1C1C1C] rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-[#F5F5F5]">Desbloqueio Biométrico</p>
                    <p className="text-[10px] text-[#A3A3A3]">Face ID / Touch ID / WebAuthn</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={biometricsEnabled}
                    onChange={async e => {
                      const val = e.target.checked;
                      setBiometricsEnabled(val);
                      await updateUserProfileData({
                        security: {
                          pinEnabled: true,
                          autoLockMinutes,
                          biometricsEnabled: val,
                        },
                      });
                    }}
                    className="w-4 h-4 text-[#D97757] accent-[#D97757]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Password change notice */}
          <div className="p-3.5 bg-[#1C1C1C] rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#F5F5F5]">
                Alterar Senha e Desconectar Outros Dispositivos
              </p>
              <p className="text-[11px] text-[#A3A3A3]">
                O Firebase invalida sessões antigas automaticamente após a troca de senha.
              </p>
            </div>
            <button
              onClick={async () => {
                if (currentUser?.email) {
                  await resetPassword(currentUser.email);
                  setFeedback({
                    type: 'success',
                    text: `Link de alteração de senha enviado para ${currentUser.email}!`,
                  });
                }
              }}
              className="px-3.5 py-1.5 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl"
            >
              Alterar Senha
            </button>
          </div>
        </div>
      </div>

      {/* 4. Notificações */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#2B2B2B]">
          <Bell className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm text-[#F5F5F5]">Notificações e Alertas</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 bg-[#1C1C1C] rounded-2xl">
            <div>
              <p className="text-xs font-semibold text-[#F5F5F5]">Notificações do Navegador</p>
              <p className="text-[11px] text-[#A3A3A3]">
                Disparadas ao abrir o app para contas que estão vencendo.
              </p>
            </div>
            <input
              type="checkbox"
              checked={browserNotifications}
              onChange={e => handleToggleBrowserNotifications(e.target.checked)}
              className="w-4 h-4 text-[#D97757] accent-[#D97757]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Avisar com antecedência de:
              </label>
              <select
                value={daysBefore}
                onChange={async e => {
                  const days = parseInt(e.target.value, 10) as 1 | 3 | 7;
                  setDaysBefore(days);
                  await updateUserProfileData({
                    notificationSettings: {
                      daysBefore: days,
                      browserNotifications,
                      dailyReminder,
                      dailyReminderTime,
                    },
                  });
                }}
                className="w-full px-3 py-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5]"
              >
                <option value={1}>1 dia antes do vencimento</option>
                <option value={3}>3 dias antes do vencimento</option>
                <option value={7}>7 dias antes do vencimento</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#1C1C1C] rounded-xl">
              <div>
                <p className="text-xs font-semibold text-[#F5F5F5]">Lembrete Diário de Gastos</p>
                <p className="text-[10px] text-[#A3A3A3]">
                  {`"Já registrou seus gastos de hoje?"`}
                </p>
              </div>
              <input
                type="checkbox"
                checked={dailyReminder}
                onChange={async e => {
                  const val = e.target.checked;
                  setDailyReminder(val);
                  await updateUserProfileData({
                    notificationSettings: {
                      daysBefore,
                      browserNotifications,
                      dailyReminder: val,
                      dailyReminderTime,
                    },
                  });
                }}
                className="w-4 h-4 text-[#D97757] accent-[#D97757]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Dados, Privacidade e LGPD */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#2B2B2B]">
          <FileText className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm text-[#F5F5F5]">Dados e Privacidade (LGPD)</h3>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#1C1C1C] rounded-2xl">
            <div>
              <p className="text-xs font-bold text-[#F5F5F5]">Exportar Meus Dados</p>
              <p className="text-[11px] text-[#A3A3A3]">
                Baixe uma cópia integral de todos os seus dados em formato JSON ou CSV.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportDataCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                <Download className="w-4 h-4 text-[#38BDF8]" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => {
                  exportBackupJSON({
                    userProfile,
                    workspace,
                    accounts,
                    categories,
                    transactions,
                    budgets,
                    goals,
                    exportedAt: new Date().toISOString(),
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                <Download className="w-4 h-4 text-[#4ADE80]" />
                <span>Exportar JSON</span>
              </button>
            </div>
          </div>

          {/* Limpar Dados (Com Lixeira e Confirmação "LIMPAR") */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-[#FBBF24]">Limpar Todos os Dados deste Workspace</p>
              <p className="text-[11px] text-[#A3A3A3]">
                Move todos os lançamentos, contas e categorias para a lixeira (com opção de restaurar depois).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {totalTrashCount > 0 && (
                <button
                  onClick={() => setShowTrashModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1C1C1C] hover:bg-[#2B2B2B] border border-[#FBBF24]/40 text-xs font-semibold text-[#FBBF24] rounded-xl transition-colors"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  <span>Ver Lixeira ({totalTrashCount})</span>
                </button>
              )}
              <button
                onClick={() => {
                  setClearConfirmationText('');
                  setShowClearModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FBBF24] hover:bg-[#F59E0B] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Limpar Dados</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#F87171]/10 border border-[#F87171]/20 rounded-2xl">
            <div>
              <p className="text-xs font-bold text-[#F87171]">Excluir Minha Conta e Meus Dados</p>
              <p className="text-[11px] text-[#A3A3A3]">
                Apaga definitivamente todos os seus lançamentos, contas e histórico conforme a LGPD.
              </p>
            </div>
            <button
              onClick={() => {
                setDeleteConfirmationText('');
                setShowDeleteModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F87171] hover:bg-[#EF4444] text-xs font-bold text-[#0A0A0A] rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Conta</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Armazenamento Offline e PWA */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#D97757]" />
            <h3 className="font-bold text-sm text-[#F5F5F5]">Modo Offline & Cache Local (PWA)</h3>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1C1C1C] border border-[#2B2B2B] text-xs">
            {isOfflineMode ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span className="text-[#FBBF24] font-semibold">Sem Conexão</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />
                <span className="text-[#4ADE80] font-semibold">Conectado</span>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-[#A3A3A3] leading-relaxed">
          O <strong>{APP_NAME}</strong> utiliza Service Workers e a Cache API do navegador para armazenar localmente seu aplicativo e seus lançamentos financeiros. Você pode consultar contas, transações recentes e resumos mesmo sem conexão com a internet.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl">
            <p className="text-[11px] text-[#A3A3A3] font-medium">Service Worker</p>
            <p className="text-xs font-bold text-[#4ADE80] mt-0.5">Ativo & Cache Automático</p>
          </div>
          <div className="p-3 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl">
            <p className="text-[11px] text-[#A3A3A3] font-medium">Lançamentos em Cache</p>
            <p className="text-xs font-bold text-[#F5F5F5] mt-0.5">
              {transactions.length} transações salvas
            </p>
          </div>
          <div className="p-3 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl">
            <p className="text-[11px] text-[#A3A3A3] font-medium">Última Sincronização</p>
            <p className="text-xs font-bold text-[#F5F5F5] mt-0.5">{lastSyncTime || 'Recente'}</p>
          </div>
        </div>

        {pendingOfflineCount > 0 && (
          <div className="p-3 bg-[#D97757]/15 border border-[#D97757]/30 rounded-2xl text-xs text-[#D97757] font-semibold flex items-center justify-between">
            <span>{pendingOfflineCount} lançamento(s) criado(s) offline aguardando conexão</span>
            <span className="text-[11px] bg-[#D97757]/20 px-2 py-0.5 rounded">
              Fila de sincronização ativa
            </span>
          </div>
        )}

        {syncStatusMsg && (
          <div className="p-3 bg-[#4ADE80]/15 border border-[#4ADE80]/30 rounded-2xl text-xs text-[#4ADE80] font-medium">
            {syncStatusMsg}
          </div>
        )}

        <div className="pt-1 flex items-center justify-between">
          <button
            onClick={handleManualCacheSync}
            disabled={isSyncingCache}
            className="flex items-center gap-2 px-4 py-2 bg-[#1C1C1C] hover:bg-[#2B2B2B] border border-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCache ? 'animate-spin' : ''}`} />
            <span>
              {isSyncingCache ? 'Atualizando Cache...' : 'Atualizar Cache Offline Agora'}
            </span>
          </button>
        </div>
      </div>

      {/* 7. Sobre o App e Tutorial */}
      <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
          <h3 className="font-bold text-sm text-[#F5F5F5]">Sobre o {APP_NAME}</h3>
          <span className="text-xs text-[#D97757] font-semibold">Versão 1.0.0</span>
        </div>

        <p className="text-xs text-[#A3A3A3] leading-relaxed">
          O {APP_NAME} é um aplicativo de gestão financeira pessoal e familiar completo, projetado com isolamento total dos dados, suporte a contas, cartões de crédito, orçamentos 50/30/20, metas com aportes, relatórios em PDF/Excel e proteção com PIN criptografado.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onShowTutorial}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-xs font-semibold text-[#D97757] rounded-xl border border-[#2B2B2B]"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Rever Tutorial de Primeiros Passos</span>
          </button>

          <button
            onClick={() => onNavigateTab('legal')}
            className="px-3.5 py-2 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-xs font-semibold text-[#A3A3A3] hover:text-[#F5F5F5] rounded-xl border border-[#2B2B2B]"
          >
            Termos de Uso e Política de Privacidade
          </button>
        </div>
      </div>

      {/* Setup PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-[#F5F5F5]">Configurar PIN do Dispositivo</h3>
            <p className="text-xs text-[#A3A3A3]">
              Digite um código numérico de 4 a 6 dígitos para bloquear o aplicativo.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Novo PIN (4 a 6 dígitos)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="••••"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-widest text-xl px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Confirme o PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="••••"
                  value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-widest text-xl px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2 bg-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePin}
                className="px-5 py-2 bg-[#D97757] text-xs font-bold text-[#0A0A0A] rounded-xl"
              >
                Salvar PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Workspace Data Modal (Com digitação "LIMPAR") */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#FBBF24]/40 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-[#F5F5F5]">
            <div className="flex items-center gap-2 text-[#FBBF24]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base">Limpar Dados do Workspace</h3>
            </div>
            <p className="text-xs text-[#A3A3A3]">
              Isso moverá todas as contas, categorias, transações, orçamentos e metas para a lixeira. Você poderá restaurá-los depois caso tenha feito por engano.
            </p>
            <p className="text-xs text-[#F5F5F5]">
              Digite a palavra <strong className="text-[#FBBF24]">LIMPAR</strong> para confirmar:
            </p>
            <input
              type="text"
              value={clearConfirmationText}
              onChange={e => setClearConfirmationText(e.target.value)}
              placeholder="LIMPAR"
              className="w-full px-3 py-2 bg-[#141414] border border-[#FBBF24]/40 rounded-xl text-xs text-[#F5F5F5] font-mono focus:outline-none focus:border-[#FBBF24]"
            />
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="px-4 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllData}
                disabled={clearConfirmationText !== 'LIMPAR' || isClearing}
                className="px-5 py-2 bg-[#FBBF24] hover:bg-[#F59E0B] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40"
              >
                {isClearing ? 'Limpando...' : 'Confirmar Limpeza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash / Lixeira Modal */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-[#F5F5F5] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-2 text-[#FBBF24]">
                <ArchiveRestore className="w-5 h-5" />
                <h3 className="font-bold text-base">Lixeira do Workspace</h3>
              </div>
              <button onClick={() => setShowTrashModal(false)} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#A3A3A3]">
              Aqui estão todos os itens removidos por engano. Clique em <strong>Restaurar</strong> para trazê-los de volta.
            </p>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {totalTrashCount === 0 ? (
                <p className="text-xs text-[#A3A3A3] py-12 text-center">A lixeira está vazia.</p>
              ) : (
                <>
                  {trashItems.accounts?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">Contas & Cartões</span>
                      {trashItems.accounts.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between p-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs">
                          <span className="font-semibold">{acc.name}</span>
                          <button
                            onClick={() => restoreTrashItem('account', acc.id)}
                            className="px-3 py-1 bg-[#4ADE80]/20 text-[#4ADE80] font-bold rounded-lg hover:bg-[#4ADE80]/30 transition-colors"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {trashItems.categories?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">Categorias</span>
                      {trashItems.categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs">
                          <span className="font-semibold">{cat.name} ({cat.type})</span>
                          <button
                            onClick={() => restoreTrashItem('category', cat.id)}
                            className="px-3 py-1 bg-[#4ADE80]/20 text-[#4ADE80] font-bold rounded-lg hover:bg-[#4ADE80]/30 transition-colors"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {trashItems.transactions?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">Lançamentos</span>
                      {trashItems.transactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{tx.description}</p>
                            <p className="text-[10px] text-[#A3A3A3]">{tx.date} • {formatMoney(tx.amountCents)}</p>
                          </div>
                          <button
                            onClick={() => restoreTrashItem('transaction', tx.id)}
                            className="px-3 py-1 bg-[#4ADE80]/20 text-[#4ADE80] font-bold rounded-lg hover:bg-[#4ADE80]/30 transition-colors shrink-0 ml-2"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {trashItems.budgets?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">Orçamentos</span>
                      {trashItems.budgets.map(b => (
                        <div key={b.id} className="flex items-center justify-between p-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs">
                          <span className="font-semibold">Teto: {formatMoney(b.limitCents)}</span>
                          <button
                            onClick={() => restoreTrashItem('budget', b.id)}
                            className="px-3 py-1 bg-[#4ADE80]/20 text-[#4ADE80] font-bold rounded-lg hover:bg-[#4ADE80]/30 transition-colors"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {trashItems.goals?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">Metas</span>
                      {trashItems.goals.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs">
                          <span className="font-semibold">{g.name}</span>
                          <button
                            onClick={() => restoreTrashItem('goal', g.id)}
                            className="px-3 py-1 bg-[#4ADE80]/20 text-[#4ADE80] font-bold rounded-lg hover:bg-[#4ADE80]/30 transition-colors"
                          >
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowTrashModal(false)}
                className="px-5 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-bold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#F87171]/40 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-[#F87171]">Excluir Conta Definitivamente?</h3>
            <p className="text-xs text-[#A3A3A3]">
              Esta ação é irreversível. Todos os seus dados, workspaces e histórico financeiro serão apagados permanentemente.
            </p>
            <p className="text-xs text-[#F5F5F5]">
              Digite a palavra <strong>EXCLUIR</strong> para confirmar:
            </p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={e => setDeleteConfirmationText(e.target.value)}
              placeholder="EXCLUIR"
              className="w-full px-3 py-2 bg-[#141414] border border-[#F87171]/40 rounded-xl text-xs text-[#F5F5F5] font-mono"
            />
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText !== 'EXCLUIR' || isDeleting}
                className="px-5 py-2 bg-[#F87171] text-xs font-bold text-[#0A0A0A] rounded-xl disabled:opacity-40"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};