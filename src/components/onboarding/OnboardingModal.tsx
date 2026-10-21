import React, { useState } from 'react';
import {
  Wallet,
  PlusCircle,
  CalendarDays,
  Target,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
} from 'lucide-react';
import { APP_NAME } from '../../lib/constants';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: `Bem-vindo ao ${APP_NAME}!`,
      subtitle: 'Sua gestão financeira pessoal e familiar completa, inteligente e segura.',
      icon: Sparkles,
      iconColor: '#D97757',
      description:
        'Controle suas entradas e saídas de dinheiro, contas a pagar, cartões de crédito e metas em um só lugar, com isolamento total dos seus dados.',
    },
    {
      title: 'Lançamentos Rápidos e Flexíveis',
      subtitle: 'Registre receitas, despesas e transferências em segundos.',
      icon: PlusCircle,
      iconColor: '#4ADE80',
      description:
        'Acesse os botões verdes (+) e vermelhos (-) no topo ou no botão flutuante. Crie parcelamentos automáticos, recorrências mensais e anexe comprovantes.',
    },
    {
      title: 'Contas a Pagar e Calendário',
      subtitle: 'Nunca mais esqueça uma conta ou pague juros por atraso.',
      icon: CalendarDays,
      iconColor: '#FBBF24',
      description:
        'Visualize contas vencidas e a vencer organizadas por seções e no calendário mensal com pontos interativos. Marque como pago com apenas um toque.',
    },
    {
      title: 'Orçamentos e Metas de Economia',
      subtitle: 'Três modos de orçamento e acompanhamento de sonhos.',
      icon: Target,
      iconColor: '#A855F7',
      description:
        'Planeje seus gastos por Categoria, pela Regra 50/30/20 ou Orçamento Base Zero. Defina metas financeiras e registre aportes periódicos.',
    },
    {
      title: 'Relatórios, Insights e Exportação',
      subtitle: 'Gráficos completos, diagnósticos inteligentes e backups.',
      icon: BarChart3,
      iconColor: '#38BDF8',
      description:
        'Acompanhe o Total Gasto e a evolução patrimonial. Receba alertas automáticos de economia e exporte relatórios profissionais em PDF, Excel, CSV ou JSON.',
    },
  ];

  const current = steps[currentStep];
  const Icon = current.icon;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Skip button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-xs text-[#A3A3A3] hover:text-[#F5F5F5] font-semibold"
        >
          Pular
        </button>

        {/* Step Icon */}
        <div className="flex justify-center pt-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: `${current.iconColor}20`, color: current.iconColor }}
          >
            <Icon className="w-8 h-8" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-2">
          <span className="text-[10px] font-bold tracking-widest text-[#D97757] uppercase">
            Passo {currentStep + 1} de {steps.length}
          </span>
          <h3 className="text-lg font-bold text-[#F5F5F5]">{current.title}</h3>
          <p className="text-xs font-semibold text-[#D97757]">{current.subtitle}</p>
          <p className="text-xs text-[#A3A3A3] leading-relaxed pt-2">
            {current.description}
          </p>
        </div>

        {/* Dots progress indicator */}
        <div className="flex justify-center items-center gap-1.5 pt-2">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentStep ? 'w-6 bg-[#D97757]' : 'w-1.5 bg-[#2B2B2B]'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2">
          {currentStep > 0 ? (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-[#A3A3A3] hover:text-[#F5F5F5]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-5 py-2.5 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            <span>{isLast ? 'Começar a Usar' : 'Próximo'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
