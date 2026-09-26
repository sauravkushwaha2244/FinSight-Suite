'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import {
  Sparkles, RefreshCw, CheckCircle2, AlertCircle, X,
  Brain, Wallet, ShieldAlert, ArrowRight, Layers, TrendingUp
} from 'lucide-react';

export default function GenerateAnalysisModal({ isOpen, onClose, onSuccess }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState('balanced');
  const [budgetTotal, setBudgetTotal] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setRunning(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        scenario_type: scenario,
        ...(budgetTotal && Number(budgetTotal) > 0 ? { total_budget: Number(budgetTotal) } : {})
      };

      const res = await api.post('/analysis/generate', payload);
      setResult(res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to generate financial analysis');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden transition-all">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Generate Financial Analysis
              </h3>
              <p className="text-xs text-slate-300">
                Unified AI Pipeline: XGBoost Forecast + SLSQP Budget + 5-Indicator Risk
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Architecture Diagram */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
              Autonomous Orchestration Pipeline
            </p>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <Brain className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800">Forecast</p>
                <p className="text-[10px] text-slate-500">XGBoost ML</p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <Wallet className="w-4 h-4 text-secondary-600 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800">Budget</p>
                <p className="text-[10px] text-slate-500">SLSQP Optimization</p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800">Risk</p>
                <p className="text-[10px] text-slate-500">5 Risk Indicators</p>
              </div>
            </div>

            <div className="mt-3 pt-2 text-center border-t border-slate-200/70 text-[11px] text-slate-500 font-medium">
              Synchronizes unified findings directly onto the Executive Dashboard.
            </div>
          </div>

          {/* Configuration Form */}
          {!result && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Optimization Scenario
                </label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="input-field text-sm font-semibold"
                  disabled={running}
                >
                  <option value="balanced">Balanced (Priorities + ROI)</option>
                  <option value="growth">Growth (Max Revenue/ROI)</option>
                  <option value="conservative">Conservative (Cost Reduction)</option>
                  <option value="high_risk">High Risk (Aggressive Rebalance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Target Budget (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1000000 (Defaults to current)"
                  value={budgetTotal}
                  onChange={(e) => setBudgetTotal(e.target.value)}
                  className="input-field text-sm"
                  disabled={running}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Summary */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-success-50 border border-success-200">
                <div className="flex items-center gap-2 text-success-800 font-bold text-sm mb-2">
                  <CheckCircle2 className="w-4 h-4 text-success-600" />
                  Financial Analysis Generated & Synced!
                </div>
                <p className="text-xs text-success-900 leading-relaxed font-medium">
                  {result.summary?.narrative}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">ML Forecast</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{result.summary?.formatted_predicted_spend}</p>
                  <p className="text-[10px] text-slate-500">Next Month</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Optimized Budget</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{result.summary?.formatted_budget}</p>
                  <p className="text-[10px] text-slate-500">{result.summary?.scenario_type}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Risk Score</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{result.summary?.risk_score?.toFixed(1)}/100</p>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">{result.summary?.risk_severity}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-outline text-xs py-2 px-4"
          >
            {result ? 'Close' : 'Cancel'}
          </button>

          {!result ? (
            <button
              onClick={handleGenerate}
              disabled={running}
              className="btn-primary text-xs py-2 px-5 shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Executing Analysis Pipeline...' : 'Generate Analysis'}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="btn-primary text-xs py-2 px-5"
            >
              View Updated Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
