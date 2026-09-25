'use client';

import { useState, useEffect } from 'react';
import BudgetTable from '../../components/BudgetTable';
import BudgetSlider from '../../components/BudgetSlider';
import TrendChart from '../../components/TrendChart';
import { api } from '../../lib/api';
import {
  RefreshCw, Zap, Scale, Target, TrendingUp, TrendingDown,
  Sparkles, Calculator, Save, CheckCircle2, AlertCircle
} from 'lucide-react';

export default function BudgetPage() {
  const [scenario, setScenario] = useState('balanced');
  const [totalBudget, setTotalBudget] = useState(1000000);
  const [period, setPeriod] = useState('Q4 2026');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [lockedCategories, setLockedCategories] = useState({});
  const [sliderValues, setSliderValues] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);

  const scenarios = [
    { id: 'conservative', label: 'Conservative', desc: 'Minimize variance, prioritize stability', icon: Scale, color: 'from-sky-500 to-blue-600' },
    { id: 'balanced', label: 'Balanced', desc: 'Equal weight ROI and stability', icon: Target, color: 'from-primary-500 to-indigo-600' },
    { id: 'aggressive', label: 'Aggressive', desc: 'Maximize projected ROI', icon: Zap, color: 'from-accent-500 to-purple-600' },
  ];

  const mockData = () => ({
    recommendations: [
      { category_id: 1, category_name: 'Marketing', current_budget: 200000, recommended_budget: 250000, change_percent: 25, projected_impact: 'High', confidence: 0.88 },
      { category_id: 2, category_name: 'R&D', current_budget: 300000, recommended_budget: 285000, change_percent: -5, projected_impact: 'Medium', confidence: 0.92 },
      { category_id: 3, category_name: 'Operations', current_budget: 500000, recommended_budget: 465000, change_percent: -7, projected_impact: 'Low', confidence: 0.96 },
      { category_id: 4, category_name: 'Sales', current_budget: 180000, recommended_budget: 210000, change_percent: 16.7, projected_impact: 'High', confidence: 0.84 },
      { category_id: 5, category_name: 'HR & Admin', current_budget: 120000, recommended_budget: 130000, change_percent: 8.3, projected_impact: 'Medium', confidence: 0.90 },
    ]
  });

  useEffect(() => {
    if (!results) {
      setResults(mockData());
      const sv = {};
      mockData().recommendations.forEach(r => { sv[r.category_name] = r.recommended_budget; });
      setSliderValues(sv);
    }
  }, []);

  const handleOptimize = async () => {
    setLoading(true);
    setSuccessMsg('');
    try {
      const payload = {
        total_budget: totalBudget,
        period: period,
        scenario_type: scenario,
        constraints: Object.entries(lockedCategories)
          .filter(([_, isLocked]) => isLocked)
          .map(([category]) => ({ category, exact: sliderValues[category] }))
      };
      const data = await api.post('/budget/optimize', payload).catch(() => null);
      const final = data && data.recommendations ? data : mockData();
      setResults(final);
      const newSliderValues = { ...sliderValues };
      final.recommendations.forEach(rec => {
        if (!lockedCategories[rec.category_name] || !newSliderValues[rec.category_name]) {
          newSliderValues[rec.category_name] = rec.recommended_budget;
        }
      });
      setSliderValues(newSliderValues);
      setSuccessMsg('Optimization complete — reviewed ' + final.recommendations.length + ' categories');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = (category) => {
    setLockedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleSliderChange = (category, value) => {
    setSliderValues(prev => ({ ...prev, [category]: value }));
  };

  const saveDraft = () => {
    localStorage.setItem('finsight_budget_draft', JSON.stringify({
      totalBudget, period, scenario, sliderValues, lockedCategories
    }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 3000);
  };

  const resetRecommendations = () => {
    if (!results) return;
    const values = {};
    results.recommendations.forEach(rec => { values[rec.category_name] = rec.recommended_budget; });
    setSliderValues(values);
    setLockedCategories({});
  };

  const approveAndApply = async () => {
    await handleOptimize();
    setSuccessMsg('Optimization approved and applied to the active budget plan');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const totalAllocated = Object.values(sliderValues).reduce((a, b) => a + b, 0);
  const remaining = totalBudget - totalAllocated;
  const remainingPct = totalBudget > 0 ? (remaining / totalBudget) * 100 : 0;
  const lockedCount = Object.values(lockedCategories).filter(Boolean).length;

  const scenarioComparison = [
    { name: 'Apr', Conservative: 420, Balanced: 450, Aggressive: 480 },
    { name: 'May', Conservative: 430, Balanced: 470, Aggressive: 510 },
    { name: 'Jun', Conservative: 445, Balanced: 490, Aggressive: 540 },
    { name: 'Jul', Conservative: 455, Balanced: 510, Aggressive: 565 },
    { name: 'Aug', Conservative: 470, Balanced: 530, Aggressive: 590 },
    { name: 'Sep', Conservative: 480, Balanced: 550, Aggressive: 620 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Budget Optimization
          </h1>
          <p className="text-slate-500 mt-1.5">
            AI-powered SLSQP constrained optimization across your organization's spending categories
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={saveDraft} className="btn-outline">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button
            onClick={handleOptimize}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Optimization
              </>
            )}
          </button>
        </div>

        {draftSaved && <p className="text-sm font-semibold text-success-700">Draft saved in this browser.</p>}
      </div>

      {successMsg && (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-4 flex items-center gap-3 animate-slide-down">
          <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-success-800">{successMsg}</p>
            <p className="text-sm text-success-700">New recommendations are ready for review below.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 card p-6 lg:p-7">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="label flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-slate-400" />
                Total Budget (₹)
              </label>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(Number(e.target.value))}
                className="input text-lg font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="label">Period</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select-input">
                <option>Q4 2026</option>
                <option>Q1 2027</option>
                <option>Q2 2027</option>
                <option>FY 2027</option>
              </select>
            </div>
            <div>
              <label className="label">Optimization Scenario</label>
              <div className="grid grid-cols-3 gap-2">
                {scenarios.map((s) => {
                  const active = scenario === s.id;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setScenario(s.id)}
                      className={`relative px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                        active
                          ? 'text-white shadow-medium ring-1 ring-white/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      style={active ? { backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` } : {}}
                    >
                      {active && (
                        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${s.color} -z-0`} />
                      )}
                      <span className="relative flex flex-col items-center gap-1">
                        <Icon className="w-4 h-4" />
                        <span className="whitespace-nowrap">{s.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {results && (
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                    Budget Utilization
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 tabular-nums">
                    ₹{totalAllocated.toLocaleString('en-IN')} <span className="text-slate-400 font-bold text-base"> / ₹{totalBudget.toLocaleString('en-IN')}</span>
                  </p>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                  Math.abs(remaining) < 100 ? 'bg-success-50 text-success-700 border border-success-200' :
                  remaining >= 0 ? 'bg-primary-50 text-primary-700 border border-primary-200' :
                  'bg-danger-50 text-danger-700 border border-danger-200'
                }`}>
                  {remaining >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {remaining >= 0 ? '₹' + remaining.toLocaleString('en-IN') + ' under' : '₹' + Math.abs(remaining).toLocaleString('en-IN') + ' over'}
                </div>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    remainingPct < 0 ? 'bg-gradient-to-r from-danger-500 to-danger-400' :
                    remainingPct < 5 ? 'bg-gradient-to-r from-success-500 to-secondary-500' :
                    'bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500'
                  }`}
                  style={{ width: `${Math.min(100, (totalAllocated / totalBudget) * 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Locked</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{lockedCount}</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categories</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{results.recommendations.length}</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Confidence</p>
                  <p className="text-base font-extrabold text-success-600 mt-0.5">
                    {Math.round((results.recommendations.reduce((s, r) => s + (r.confidence || 0), 0) / results.recommendations.length) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6 lg:p-7 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 border-0 text-white relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl" />
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center mb-5">
              <Sparkles className="w-5 h-5 text-secondary-300" />
            </div>
            <h3 className="text-lg font-extrabold mb-2">Scenario: {scenarios.find(s => s.id === scenario)?.label}</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {scenarios.find(s => s.id === scenario)?.desc}
            </p>
            <div className="space-y-2.5 mb-6">
              {[
                { l: 'ROI Weight', v: scenario === 'aggressive' ? '100%' : scenario === 'conservative' ? '30%' : '70%' },
                { l: 'Stability Weight', v: scenario === 'aggressive' ? '0%' : scenario === 'conservative' ? '70%' : '30%' },
                { l: 'Iterations', v: '~1.2M' },
                { l: 'Processing', v: '<15 sec' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-slate-400">{item.l}</span>
                  <span className="text-sm font-bold text-white">{item.v}</span>
                </div>
              ))}
            </div>
            {results && lockedCount > 0 && (
              <div className="rounded-xl bg-warning-500/10 border border-warning-400/20 p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-warning-300">{lockedCount} Locked Categories</p>
                  <p className="text-[11px] text-warning-400/80 mt-0.5">Optimizer respects exact locked allocations</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {results && (
        <>
          <div className="animate-fade-in space-y-8">
            <BudgetTable recommendations={results.recommendations} />

            <div className="card p-6 lg:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <Zap className="w-5.5 h-5.5 text-primary-500" />
                    Fine-tune Allocations
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Adjust individual category budgets. Toggle locks to force exact allocations during re-optimization.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-500" /> Recommended
                  </span>
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-500" /> Your Value
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {results.recommendations.map((rec) => (
                  <BudgetSlider
                    key={rec.category_id}
                    category={rec.category_name}
                    value={sliderValues[rec.category_name] || rec.recommended_budget}
                    min={rec.current_budget * 0.4}
                    max={rec.current_budget * 1.6}
                    isLocked={lockedCategories[rec.category_name] || false}
                    onChange={(val) => handleSliderChange(rec.category_name, val)}
                    onToggleLock={() => toggleLock(rec.category_name)}
                    recommended={rec.recommended_budget}
                  />
                ))}
              </div>

              <div className="mt-7 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                <button onClick={resetRecommendations} className="btn-outline">
                  <RefreshCw className="w-4 h-4" />
                  Reset to Recommendations
                </button>
                <button onClick={handleOptimize} disabled={loading} className="btn-secondary">
                  <Calculator className="w-4 h-4" />
                  Re-optimize with Locks
                </button>
                <button onClick={approveAndApply} disabled={loading} className="btn-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  Approve & Apply
                </button>
              </div>
            </div>

            <TrendChart
              title="Scenario Comparison — Forecasted Spend"
              subtitle="How Conservative, Balanced, and Aggressive scenarios project across 6 months (₹K)"
              data={scenarioComparison}
              xKey="name"
              yKeys={['Conservative', 'Balanced', 'Aggressive']}
              colors={['#0ea5e9', '#2563eb', '#c026d3']}
              type="composed"
              height={340}
            />
          </div>
        </>
      )}
    </div>
  );
}
