import React from 'react';
import { formatMoneyWithoutSymbol, getCurrencySymbol } from '../../lib/money';

interface CurrencyInputProps {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  currencySymbol?: string;
  className?: string;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  valueCents,
  onChangeCents,
  currencySymbol,
  className = '',
  id,
  placeholder = '0,00',
  autoFocus = false,
}) => {
  const symbol = currencySymbol || getCurrencySymbol();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const cents = rawDigits ? parseInt(rawDigits, 10) : 0;
    onChangeCents(cents);
  };

  const displayValue = valueCents > 0 ? formatMoneyWithoutSymbol(valueCents) : '';

  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-sm font-semibold text-[#A3A3A3] select-none">
        {symbol}
      </span>
      <input
        type="text"
        inputMode="numeric"
        id={id}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        className={`w-full pl-11 pr-4 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-[#F5F5F5] font-semibold text-lg focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] tabular-nums transition-colors ${className}`}
      />
    </div>
  );
};