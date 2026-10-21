import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDisplayDate, todayString } from '../../lib/dates';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentDate = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(currentDate.getMonth()); // 0-11

  useEffect(() => {
    if (value) {
      const parsed = new Date(value + 'T12:00:00');
      if (!isNaN(parsed.getTime())) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const selectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-elevated,#1C1C1C)] border border-[var(--border-color,#2B2B2B)] rounded-xl text-xs sm:text-sm text-[var(--text-primary,#F5F5F5)] focus:outline-none focus:border-[#D97757] transition-colors ${className}`}
      >
        <span className="tabular-nums">{value ? formatDisplayDate(value) : 'Selecione a data'}</span>
        <CalendarIcon className="w-4 h-4 text-[#D97757]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl shadow-2xl p-4 z-60 animate-in fade-in zoom-in-95 text-[#F5F5F5]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2B2B2B]">
            <span className="font-bold text-xs capitalize text-[#D97757]">
              {monthNames[viewMonth]} de {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 bg-[#141414] hover:bg-[#2B2B2B] rounded-lg text-[#F5F5F5]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 bg-[#141414] hover:bg-[#2B2B2B] rounded-lg text-[#F5F5F5]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#A3A3A3] mb-1">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const mStr = String(viewMonth + 1).padStart(2, '0');
              const dStr = String(dayNum).padStart(2, '0');
              const dateStr = `${viewYear}-${mStr}-${dStr}`;
              const isSelected = value === dateStr;
              const isToday = todayString() === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => selectDay(dayNum)}
                  className={`h-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#D97757] text-[#0A0A0A] font-bold shadow-md'
                      : isToday
                      ? 'bg-[#141414] text-[#D97757] border border-[#D97757]/50 font-bold'
                      : 'hover:bg-[#2B2B2B] text-[#F5F5F5]'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#2B2B2B] text-xs">
            <button
              type="button"
              onClick={() => {
                onChange(todayString());
                setIsOpen(false);
              }}
              className="text-[#D97757] font-semibold hover:underline"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#A3A3A3] hover:text-[#F5F5F5]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};