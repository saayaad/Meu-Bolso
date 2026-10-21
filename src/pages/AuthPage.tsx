import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { translateAuthError } from '../lib/authErrors';
import { APP_NAME } from '../lib/constants';

interface AuthPageProps {
  onOpenLegal: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onOpenLegal }) => {
  const {
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 4
  };

  const passScore = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Informe seu e-mail para recuperar a senha.');
        return;
      }
      setIsLoading(true);
      try {
        await resetPassword(email.trim());
        setSuccessMsg('Enviamos um link de recuperação para o seu e-mail!');
      } catch (err: unknown) {
        const code = (err as { code?: string }).code || '';
        setErrorMsg(translateAuthError(code));
      }
      setIsLoading(false);
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMsg('Informe seu nome completo.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('A senha deve ter no mínimo 8 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas não coincidem.');
        return;
      }
      if (!acceptedTerms) {
        setErrorMsg('Você precisa aceitar os Termos de Uso e a Política de Privacidade.');
        return;
      }

      setIsLoading(true);
      try {
        await registerWithEmail(name.trim(), email.trim(), password, new Date().toISOString());
      } catch (err: unknown) {
        const code = (err as { code?: string }).code || '';
        setErrorMsg(translateAuthError(code));
      }
      setIsLoading(false);
      return;
    }

    // Login
    if (!email.trim() || !password) {
      setErrorMsg('Preencha seu e-mail e senha.');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      setErrorMsg(translateAuthError(code));
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      setErrorMsg(translateAuthError(code));
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center px-4 py-8">
      {/* Brand Header */}
      <div className="text-center space-y-2 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#D97757] text-[#0A0A0A] font-extrabold text-2xl flex items-center justify-center mx-auto shadow-xl">
          MB
        </div>
        <h1 className="text-2xl font-extrabold text-[#F5F5F5] tracking-tight">{APP_NAME}</h1>
        <p className="text-xs text-[#A3A3A3]">Gestão financeira pessoal e familiar completa e segura</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#141414] border border-[#2B2B2B] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Mode Tabs */}
        {mode !== 'forgot' && (
          <div className="flex gap-1.5 p-1 bg-[#1C1C1C] rounded-2xl border border-[#2B2B2B]">
            <button
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                mode === 'login' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                mode === 'register' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Google One-Click Button */}
        {mode !== 'forgot' && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-[#1C1C1C] hover:bg-[#2B2B2B] border border-[#2B2B2B] rounded-xl text-xs font-semibold text-[#F5F5F5] flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar com o Google</span>
            </button>

            <div className="relative flex items-center justify-center my-2">
              <div className="absolute inset-x-0 h-px bg-[#2B2B2B]" />
              <span className="bg-[#141414] px-3 text-[11px] text-[#A3A3A3] uppercase tracking-wider relative z-10 whitespace-nowrap">
                ou com e-mail
              </span>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="p-3 bg-[#F87171]/15 border border-[#F87171]/30 rounded-xl text-xs text-[#F87171] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-[#4ADE80]/15 border border-[#4ADE80]/30 rounded-xl text-xs text-[#4ADE80] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Nome Completo</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#A3A3A3]">Senha</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg('');
                    }}
                    className="text-[11px] text-[#D97757] hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#F5F5F5]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength indicator on register */}
              {mode === 'register' && password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1 w-full bg-[#1C1C1C] rounded-full overflow-hidden">
                    <div className={`h-full flex-1 ${passScore >= 1 ? 'bg-[#EF4444]' : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 ${passScore >= 2 ? 'bg-[#FBBF24]' : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 ${passScore >= 3 ? 'bg-[#38BDF8]' : 'bg-transparent'}`} />
                    <div className={`h-full flex-1 ${passScore >= 4 ? 'bg-[#4ADE80]' : 'bg-transparent'}`} />
                  </div>
                  <span className="text-[10px] text-[#A3A3A3]">
                    Força da senha: {passScore < 2 ? 'Fraca' : passScore === 3 ? 'Boa' : 'Forte'}
                  </span>
                </div>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Confirmar Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>
          )}

          {/* Terms checkbox on register */}
          {mode === 'register' && (
            <div className="flex items-center gap-2.5 pt-2 pb-1">
              <input
                type="checkbox"
                id="termsCheck"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="shrink-0"
              />
              <label htmlFor="termsCheck" className="text-[11px] text-[#A3A3A3] leading-tight cursor-pointer">
                Li e aceito os{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenLegal();
                  }}
                  className="text-[#D97757] hover:underline font-semibold"
                >
                  Termos de Uso e a Política de Privacidade
                </button>.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isLoading
              ? 'Processando...'
              : mode === 'login'
              ? 'Entrar no Meu Bolso'
              : mode === 'register'
              ? 'Concluir Cadastro'
              : 'Enviar Instruções de Recuperação'}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="w-full text-center text-xs text-[#A3A3A3] hover:text-[#F5F5F5] pt-2"
            >
              Voltar ao Login
            </button>
          )}
        </form>
      </div>

      {/* Footer Legal links */}
      <div className="mt-8 text-center text-xs text-[#A3A3A3]">
        <button onClick={onOpenLegal} className="hover:text-[#F5F5F5] hover:underline">
          Termos de Uso e Privacidade (LGPD)
        </button>
      </div>
    </div>
  );
};