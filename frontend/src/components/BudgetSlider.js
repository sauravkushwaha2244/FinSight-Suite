'use client';

import { Lock, Unlock, Info } from 'lucide-react';

export default function BudgetSlider({
  category,
  value,
  min,
  max,
  isLocked,
  onChange,
  onToggleLock,
  description,
  recommended,
}) {
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const effectiveMin = Math.min(min, value, recommended ?? value);
  const effectiveMax = Math.max(max, value, recommended ?? value) || (effectiveMin + 1000);
  const span = effectiveMax - effectiveMin || 1;
  const percent = Math.min(100, Math.max(0, ((value - effectiveMin) / span) * 100));
  const diff = recommended ? value - recommended : 0;
  const diffPercent = recommended ? ((value - recommended) / recommended) * 100 : 0;

  return (
    <div className={`card p-5 transition-all duration-300 ${isLocked ? 'bg-slate-50/80 ring-1 ring-slate-200' : 'card-hover'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-slate-900 tracking-tight truncate">{category}</h4>
            {description && (
              <span className="text-slate-400 hover:text-slate-600 cursor-help" title={description}>
                <Info className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          {recommended && (
            <span className={`text-xs font-semibold ${
              Math.abs(diffPercent) < 1 ? 'text-success-600 bg-success-50' :
              diffPercent < 0 ? 'text-primary-600 bg-primary-50' :
              'text-warning-600 bg-warning-50'
            } px-2 py-0.5 rounded-md border border-current/10`}>
              {diffPercent === 0 ? 'At recommended' :
               diffPercent < 0 ? `${Math.abs(diffPercent).toFixed(1)}% below` :
               `${diffPercent.toFixed(1)}% above`} optimal
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-lg font-extrabold text-slate-900 tabular-nums tracking-tight">
            {formatCurrency(value)}
          </span>
          <button
            onClick={onToggleLock}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
              isLocked
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200 shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-primary-50 hover:text-primary-600'
            }`}
            title={isLocked ? 'Unlock value — allow optimizer to adjust' : 'Lock value — optimizer will respect this exact amount'}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isLocked
                ? 'bg-gradient-to-r from-slate-400 to-slate-500'
                : 'bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {recommended && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent-500"
            style={{ left: `${Math.min(100, Math.max(0, ((recommended - effectiveMin) / span) * 100))}%` }}
            title={`Recommended: ${formatCurrency(recommended)}`}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-accent-700 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded-md">
              Optimal
            </div>
          </div>
        )}
        <input
          type="range"
          min={effectiveMin}
          max={effectiveMax}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={isLocked}
          className="relative z-10 w-full h-2 bg-transparent cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-500">{formatCurrency(min)}</span>
        {recommended && (
          <span className="text-accent-600 font-bold">
            Rec: {formatCurrency(recommended)}
          </span>
        )}
        <span className="font-semibold text-slate-500">{formatCurrency(max)}</span>
      </div>

      {isLocked && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Locked — optimizer will maintain this exact allocation</span>
        </div>
      )}
    </div>
  );
}
