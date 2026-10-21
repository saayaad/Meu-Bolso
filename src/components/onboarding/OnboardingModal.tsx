import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  // Se já foi dispensado neste navegador, nunca renderiza
  if (!isOpen || typeof window !== 'undefined' && localStorage.getItem('meu_bolso_tutorial_visto') === 'true') {
    return null;
  }

  const steps = [
    {
      title: 'Bem-vindo ao Meu Bolso!',
      subtitle: 'Sua gestão financeira pessoal e familiar completa, inteligente e segura.',
      desc: 'Controle suas entradas e saídas de dinheiro, contas a pagar, cartões de crédito e metas em um só lugar, com isolamento total dos seus dados.',
    },
    {
      title: 'Workspaces Independentes',
      subtitle: 'Separe sua vida pessoal dos seus negócios e projetos.',
      desc: 'Crie múltiplos workspaces e convide familiares ou sócios com permissões seguras em tempo real.',
    },
    {
      title: 'Planejamento e Orçamentos',
      subtitle: 'Metas claras para alcançar seus objetivos.',
      desc: 'Defina limites de gastos por categoria e acompanhe suas metas financeiras com gráficos intuitivos.',
    },
    {
      title: 'Contas a Pagar e Receber',
      subtitle: 'Nunca mais esqueça uma fatura ou boleto.',
      desc: 'Receba alertas automáticos de vencimento e controle pagamentos pendentes com facilidade.',
    },
    {
      title: 'Tudo Pronto!',
      subtitle: 'Seus dados protegidos e disponíveis em qualquer dispositivo.',
      desc: 'Aproveite o app no celular ou computador. Vamos começar?',
    },
  ];

  const current = steps[step - 1];

  const handleDismiss = () => {
    localStorage.setItem('meu_bolso_tutorial_visto', 'true');
    onClose();
  };

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2B2B2B] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 text-center shadow-2xl relative">
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 text-xs text-[#A3A3A3] hover:text-[#F5F5F5] font-medium transition-colors"
        >
          Pular
        </button>

        <div className="w-16 h-16 rounded-2xl bg-[#D97757]/15 border border-[#D97757]/30 text-[#D97757] flex items-center justify-center mx-auto shadow-inner">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#D97757] uppercase tracking-widest">
            PASSO {step} DE {steps.length}
          </span>
          <h3 className="text-xl font-extrabold text-[#F5F5F5]">{current.title}</h3>
          <p className="text-xs font-semibold text-[#D97757]">{current.subtitle}</p>
          <p className="text-xs text-[#A3A3A3] leading-relaxed pt-1">{current.desc}</p>
        </div>

        <div className="flex justify-center items-center gap-1.5 pt-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step - 1 ? 'w-6 bg-[#D97757]' : 'w-1.5 bg-[#2B2B2B]'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full py-3 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <span>{step === steps.length ? 'Começar a Usar' : 'Próximo'}</span>
          {step === steps.length ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};