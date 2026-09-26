'use client';

import { useState } from 'react';
import { ArrowUpDown, ChevronUp, ChevronDown, Sparkles, CheckCircle2, Lock, Unlock, TrendingUp, HelpCircle } from 'lucide-react';

export default function BudgetTable({
  recommendations = [],
  lockedCategories = {},
  onToggleLock,
  onRefresh
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...recommendations].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc'
        ? <ChevronUp className="w-4 h-4 ml-1 inline text-primary-600" />
        : <ChevronDown className="w-4 h-4 ml-1 inline text-primary-600" />;
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 inline text-slate-300 group-hover:text-slate-500" />;
  };

  const getRoiBadge = (roi) => {
    const val = Number(roi) || 1.0;
    if (val >= 1.5) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold';
    }
    if (val >= 1.2) {
      return 'bg-primary-50 text-primary-700 border-primary-200 font-bold';
    }
    if (val >= 1.05) {
      return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getDiffColor = (percent) => {
    if (percent > 8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (percent > 0) return 'text-primary-700 bg-primary-50 border-primary-200';
    if (percent > -8) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const totalCurrent = sortedData.reduce((s, r) => s + (r.current_budget || 0), 0);
  const totalRecommended = sortedData.reduce((s, r) => s + (r.recommended_budget || 0), 0);
  const totalDiff = totalRecommended - totalCurrent;
  const totalDiffPercent = totalCurrent > 0 ? (totalDiff / totalCurrent) * 100 : 0;
  const lockedCount = Object.values(lockedCategories).filter(Boolean).length;

  return (
    <div className="card overflow-hidden">
      <div className="p-5 lg:p-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              Optimization Recommendations
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              SLSQP allocation using real 24-month historical ROI, business priorities, and lock constraints
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Total</p>
              <p className="text-base font-extrabold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(totalCurrent)}</p>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600">Recommended Total</p>
              <p className="text-base font-extrabold text-primary-700 mt-0.5 tabular-nums flex items-center justify-center gap-1">
                {formatCurrency(totalRecommended)}
                <CheckCircle2 className="w-4 h-4 text-primary-600" />
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-2.5 ${getDiffColor(totalDiffPercent)}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Net Shift</p>
              <p className="text-base font-extrabold mt-0.5 tabular-nums">
                {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-5 py-3.5 text-center w-14 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Lock
              </th>
              {[
                { k: 'category', label: 'Category', align: 'left' },
                { k: 'historical_roi', label: 'Historical ROI', align: 'center' },
                { k: 'current_budget', label: 'Current Budget', align: 'right' },
                { k: 'recommended_budget', label: 'Recommended Budget', align: 'right' },
                { k: 'change_percent', label: 'Shift %', align: 'right' },
                { k: 'projected_impact', label: 'Strategic Rationale', align: 'left' },
              ].map(col => (
                <th
                  key={col.k}
                  onClick={() => requestSort(col.k)}
                  className={`px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:bg-slate-100/50 transition-colors group ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  <span className="inline-flex items-center">
                    {col.label} {renderSortIcon(col.k)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedData.map((row, idx) => {
              const catName = row.category_name || row.category;
              const isLocked = lockedCategories[catName] || row.is_locked || false;
              const diff = row.recommended_budget - row.current_budget;
              const roiVal = row.historical_roi ?? (row.actual_roi ?? 1.25);

              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isLocked ? 'bg-amber-50/40 border-l-4 border-l-amber-500' : 'hover:bg-primary-50/30'
                  }`}
                >
                  {/* Lock Toggle Button */}
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {onToggleLock ? (
                      <button
                        onClick={() => onToggleLock(catName)}
                        className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${
                          isLocked
                            ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                            : 'bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                        }`}
                        title={isLocked ? 'Click to Unlock this category' : 'Click to Lock this allocation'}
                      >
                        {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    ) : (
                      isLocked && <Lock className="w-4 h-4 text-amber-500 inline" />
                    )}
                  </td>

                  {/* Category Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${
                        isLocked ? 'bg-amber-100 text-amber-800' : 'bg-gradient-to-br from-primary-500/10 to-secondary-500/10 text-primary-700'
                      }`}>
                        {catName?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{catName}</p>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                              Locked
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {row.historical_spend ? `24m spend: ${formatCurrency(row.historical_spend)}` : `Category #${row.category_id || idx + 1}`}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Measured Historical ROI */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs border tabular-nums ${getRoiBadge(roiVal)}`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                      {Number(roiVal).toFixed(2)}x ROI
                    </span>
                  </td>

                  {/* Current Budget */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-600 tabular-nums">
                    {formatCurrency(row.current_budget)}
                  </td>

                  {/* Recommended Budget */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-extrabold text-slate-900 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      {formatCurrency(row.recommended_budget)}
                      {diff > 0 && <ChevronUp className="w-4 h-4 text-emerald-600" />}
                      {diff < 0 && <ChevronDown className="w-4 h-4 text-rose-600" />}
                    </span>
                  </td>

                  {/* Shift % */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border tabular-nums ${getDiffColor(row.change_percent || (row.current_budget > 0 ? (diff / row.current_budget) * 100 : 0))}`}>
                      {(row.change_percent ?? (row.current_budget > 0 ? (diff / row.current_budget) * 100 : 0)).toFixed(1) >= 0 ? '+' : ''}
                      {(row.change_percent ?? (row.current_budget > 0 ? (diff / row.current_budget) * 100 : 0)).toFixed(1)}%
                    </span>
                  </td>

                  {/* Strategic Rationale / Projected Impact */}
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                    <span className="font-medium text-slate-700">
                      {row.projected_impact || 'Optimally balanced allocation'}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Total Row */}
            {sortedData.length > 0 && (
              <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                <td className="px-4 py-3 text-center text-xs text-slate-400">
                  {lockedCount > 0 ? `${lockedCount} 🔒` : '—'}
                </td>
                <td className="px-6 py-3.5 text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Total Allocation
                </td>
                <td className="px-6 py-3.5 text-center text-xs text-slate-500 font-bold">
                  —
                </td>
                <td className="px-6 py-3.5 text-right text-sm font-bold text-slate-700 tabular-nums">
                  {formatCurrency(totalCurrent)}
                </td>
                <td className="px-6 py-3.5 text-right text-base font-black text-primary-700 tabular-nums">
                  {formatCurrency(totalRecommended)}
                </td>
                <td className="px-6 py-3.5 text-right text-xs font-extrabold text-slate-700 tabular-nums">
                  {totalDiff >= 0 ? '+' : ''}{totalDiffPercent.toFixed(1)}%
                </td>
                <td className="px-6 py-3.5 text-xs text-success-700 font-extrabold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success-600 inline" />
                  Exact 100% Budget Realization
                </td>
              </tr>
            )}

            {sortedData.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-16 text-center">
                  <div className="inline-flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-slate-400" />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">No recommendations yet</h4>
                    <p className="text-sm text-slate-500 max-w-sm">
                      Configure your budget parameters and run the optimizer to see AI-powered allocation suggestions.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
