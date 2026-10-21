import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Shield,
  Lock,
  Palette,
  Upload,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Moon,
  Sun,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CurrencyCode, ThemeMode } from '../types';
import { compressImage } from '../lib/images';
import {
  setupDevicePin,
  removeDevicePin,
  isDevicePinSet,
  isBiometricsAvailable,
} from '../lib/security';

interface ProfilePageProps {
  onLockNow: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onLockNow }) => {
  const {
    currentUser,
    userProfile,
    updateUserProfileData,
    resetPassword,
    resendVerificationEmail,
  } = useAuth();

  const resolvedInitialName =
    userProfile?.name && userProfile.name !== 'Usuário'
      ? userProfile.name
      : currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Usuário');

  const resolvedEmail = userProfile?.email || currentUser?.email || '';

  const [name, setName] = useState<string>(resolvedInitialName);
  const [currency, setCurrency] = useState<CurrencyCode>(userProfile?.currency || 'BRL');
  const [theme, setTheme] = useState<ThemeMode>(userProfile?.theme || 'dark');
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    userProfile?.photoURL || currentUser?.photoURL || null
  );
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // PIN states
  const [pinEnabled, setPinEnabled] = useState<boolean>(isDevicePinSet());
  const [pinInput, setPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [autoLockMinutes, setAutoLockMinutes] = useState<1 | 5 | 15>(
    userProfile?.security?.autoLockMinutes || 5
  );
  const [biometricsSupported, setBiometricsSupported] = useState<boolean>(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(
    userProfile?.security?.biometricsEnabled || false
  );

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricsSupported);
  }, []);

  useEffect(() => {
    if (userProfile || currentUser) {
      setName(
        userProfile?.name && userProfile.name !== 'Usuário'
          ? userProfile.name
          : currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Usuário')
      );
      setCurrency(userProfile?.currency || 'BRL');
      setTheme(userProfile?.theme || 'dark');
      setPhotoPreview(userProfile?.photoURL || currentUser?.photoURL || null);
      if (userProfile?.security) {
        setAutoLockMinutes(userProfile.security.autoLockMinutes || 5);
        setBiometricsEnabled(userProfile.security.biometricsEnabled || false);
      }
    }
  }, [userProfile, currentUser]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'A imagem deve ter no máximo 5 MB.' });
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
      setFeedback({ type: 'error', text: 'Erro ao processar foto de perfil.' });
    }
  };

  const handleThemeChange = async (newTheme: ThemeMode) => {
    setTheme(newTheme);
    try {
      await updateUserProfileData({ theme: newTheme });
      setFeedback({ type: 'success', text: `Tema alterado para ${newTheme === 'dark' ? 'Escuro' : 'Claro'}!` });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao aplicar tema.' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', text: 'O nome não pode ficar em branco.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      await updateUserProfileData({
        name: name.trim(),
        currency,
        theme,
        photoURL: photoPreview,
      });
      setFeedback({ type: 'success', text: 'Suas informações de perfil foram salvas com sucesso!' });
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível salvar as alterações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4 || pinInput.length > 6) {
      setFeedback({ type: 'error', text: 'O PIN deve conter entre 4 e 6 números.' });
      return;
    }
    if (pinInput !== confirmPinInput) {
      setFeedback({ type: 'error', text: 'A confirmação do PIN não confere.' });
      return;
    }

    const ok = await setupDevicePin(pinInput);
    if (ok) {
      setPinEnabled(true);
      setPinInput('');
      setConfirmPinInput('');
      await updateUserProfileData({
        security: {
          pinEnabled: true,
          autoLockMinutes,
          biometricsEnabled,
        },
      });
      setFeedback({
        type: 'success',
        text: 'PIN de segurança ativado! Agora você pode bloquear o app a qualquer momento.',
      });
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
    setFeedback({ type: 'success', text: 'Bloqueio por PIN removido deste dispositivo.' });
  };

  const handleSendPasswordReset = async () => {
    if (!resolvedEmail) return;
    try {
      await resetPassword(resolvedEmail);
      setFeedback({
        type: 'success',
        text: `Enviamos um link de redefinição de senha para ${resolvedEmail}.`,
      });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao solicitar e-mail de redefinição de senha.' });
    }
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      setFeedback({
        type: 'success',
        text: `E-mail de verificação reenviado para ${resolvedEmail}! Verifique sua caixa de entrada.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Aguarde alguns instantes antes de solicitar outro e-mail de verificação.',
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto text-[var(--text-primary)]">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Meu Perfil</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Gerencie seus dados pessoais, preferências da conta e PIN de bloqueio rápido
          </p>
        </div>

        {pinEnabled && (
          <button
            onClick={onLockNow}
            className="flex items-center gap-2 px-4 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            <Lock className="w-4 h-4" />
            <span>Bloquear Tela Agora</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            feedback.type === 'success'
              ? 'bg-[#4ADE80]/15 border-[#4ADE80]/30 text-[#4ADE80]'
              : 'bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            ✕
          </button>
        </div>
      )}

      {/* Card Principal de Identidade do Usuário */}
      <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl flex flex-col sm:flex-row items-center gap-6 shadow-sm">
        <div className="relative group shrink-0">
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Foto de Perfil"
              className="w-24 h-24 rounded-full object-cover border-2 border-[#D97757] shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#D97757]/20 border-2 border-[#D97757] flex items-center justify-center text-[#D97757] font-extrabold text-3xl shadow-lg">
              {(name?.[0] || 'U').toUpperCase()}
            </div>
          )}
          <label className="absolute inset-0 bg-black/65 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-xs font-semibold">
            <Upload className="w-5 h-5 mb-1 text-[#D97757]" />
            <span>{isCompressingPhoto ? '...' : 'Trocar Foto'}</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h3 className="text-lg font-bold truncate">{name || 'Usuário'}</h3>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#D97757]/20 text-[#D97757] rounded-full uppercase tracking-wider">
              Conta Ativa
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#D97757]" />
            <span>{resolvedEmail || 'E-mail não informado'}</span>
          </p>

          {currentUser && !currentUser.emailVerified && (
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-[11px] text-[#FBBF24]">E-mail aguardando confirmação.</span>
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-[11px] font-semibold text-[#D97757] hover:underline flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Reenviar link de verificação</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Formulário de Dados Pessoais e Preferências */}
      <form
        onSubmit={handleSaveProfile}
        className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-5 shadow-sm"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
          <User className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm">Dados Pessoais e Preferências</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Como você quer ser chamado(a)? *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome ou apelido"
              className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              E-mail de Acesso
            </label>
            <input
              type="email"
              disabled
              value={resolvedEmail}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)]/50 border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-secondary)] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Moeda Padrão da Conta
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
            >
              <option value="BRL">Real Brasileiro (R$ - BRL)</option>
              <option value="USD">Dólar Americano ($ - USD)</option>
              <option value="EUR">Euro (€ - EUR)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Tema Visual Preferido
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl">
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#D97757] text-[#0A0A0A]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Escuro</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-[#D97757] text-[#0A0A0A]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Claro</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar Dados do Perfil'}
          </button>
        </div>
      </form>

      {/* Configuração Direta do PIN de Segurança */}
      <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#D97757]" />
            <h3 className="font-bold text-sm">PIN de Bloqueio Rápido</h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              pinEnabled
                ? 'bg-[#4ADE80]/20 text-[#4ADE80]'
                : 'bg-[#FBBF24]/20 text-[#FBBF24]'
            }`}
          >
            {pinEnabled ? 'PIN Ativo' : 'PIN Não Configurado'}
          </span>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          O PIN protege o acesso ao aplicativo neste dispositivo. Quando ativado, clicar em{' '}
          <strong className="text-[var(--text-primary)]">"Bloquear com PIN"</strong> na barra lateral tranca a
          tela imediatamente.
        </p>

        {pinEnabled ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Bloquear automaticamente após inatividade
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
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)]"
                >
                  <option value={1}>1 minuto sem uso</option>
                  <option value={5}>5 minutos sem uso</option>
                  <option value={15}>15 minutos sem uso</option>
                </select>
              </div>

              {biometricsSupported && (
                <div className="flex items-center justify-between p-3.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl">
                  <div>
                    <p className="text-xs font-semibold">Biometria do Dispositivo</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Face ID / Impressão Digital</p>
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
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onLockNow}
                className="flex items-center gap-2 px-4 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Testar Bloqueio com PIN Agora</span>
              </button>

              <button
                type="button"
                onClick={handleDisablePin}
                className="px-4 py-2 bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/30 font-semibold text-xs rounded-xl transition-colors"
              >
                Desativar PIN
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSavePin} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Crie um PIN (4 a 6 números)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Ex: 1234"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm tracking-widest text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Confirme o PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Repita o PIN"
                  value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm tracking-widest text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                Ativar PIN de Segurança
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Senha de Acesso */}
      <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Senha da Conta</h4>
            <p className="text-xs text-[var(--text-secondary)]">
              Deseja alterar sua senha de login? Enviaremos um link seguro para o seu e-mail.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSendPasswordReset}
          className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] rounded-xl transition-colors"
        >
          Enviar Link de Redefinição
        </button>
      </div>
    </div>
  );
};