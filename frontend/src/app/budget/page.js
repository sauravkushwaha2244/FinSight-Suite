'use client';

import { useState, useEffect } from 'react';
import BudgetTable from '../../components/BudgetTable';
import BudgetSlider from '../../components/BudgetSlider';
import TrendChart from '../../components/TrendChart';
import BackendError from '../../components/BackendError';
import { api } from '../../lib/api';
import {
  RefreshCw, Zap, Scale, Target, TrendingUp, TrendingDown,
  Sparkles, Calculator, Save, CheckCircle2, AlertCircle, AlertTriangle
} from 'lucide-react';

export default function BudgetPage() {
  const [scenario, setScenario] = useState('balanced');
  const [totalBudget, setTotalBudget] = useState(1000000);
  const [period, setPeriod] = useState('Q4 2026');
  const [initialLoading, setInitialLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [results, setResults] = useState(null);
  const [lockedCategories, setLockedCategories] = useState({});
  const [sliderValues, setSliderValues] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);

  const scenarios = [
    { id: 'conservative', label: 'Conservative', desc: 'Minimize variance, prioritize stability', icon: Scale, color: 'from-sky-500 to-blue-600' },
    { id: 'balanced', label: 'Balanced', desc: 'Equal weight ROI and stability', icon: Target, color: 'from-primary-500 to-indigo-600' },
    { id: 'aggressive', label: 'Aggressive', desc: 'Maximize projected ROI', icon: Zap, color: 'from-accent-500 to-purple-600' },
  ];

  const fetchInitialData = async () => {
    setInitialLoading(true);
    setErrorMsg('');
    try {
      // First try to fetch saved recommendations or categories
      const data = await api.get('/budget/recommendations');
      const recs = Array.isArray(data) ? data : (data?.recommendations || []);

      if (recs && recs.length > 0) {
        setResults({ recommendations: recs });
        const sv = {};
        const locks = {};
        recs.forEach(r => {
          const name = r.category_name || r.name || r.category;
          sv[name] = r.recommended_budget;
          if (r.is_locked) {
            locks[name] = true;
          }
        });
        setSliderValues(sv);
        setLockedCategories(locks);
        const total = recs.reduce((acc, c) => acc + (Number(c.recommended_budget || c.current_budget) || 0), 0);
        if (total > 0) setTotalBudget(total);
      } else {
        // Fetch categories to initialize baseline
        const cats = await api.get('/budget/categories');
        if (Array.isArray(cats) && cats.length > 0) {
          const recList = cats.map(c => ({
            category_id: c.id,
            category_name: c.name,
            current_budget: c.current_budget || 0,
            recommended_budget: c.current_budget || 0,
            change_percent: 0,
            projected_impact: 'Baseline',
            confidence: 0.90,
          }));
          setResults({ recommendations: recList });
          const sv = {};
          recList.forEach(r => { sv[r.category_name] = r.recommended_budget; });
          setSliderValues(sv);
          const total = recList.reduce((acc, c) => acc + (Number(c.current_budget) || 0), 0);
          if (total > 0) setTotalBudget(total);
        } else {
          setResults({ recommendations: [] });
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Backend unavailable');
      setResults(null);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOptimize = async () => {
    setOptimizing(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const lockedMap = {};
      Object.entries(lockedCategories).forEach(([category, isLocked]) => {
        if (isLocked) {
          const currentRec = results?.recommendations?.find(
            r => (r.category_name || r.name || r.category) === category
          );
          const exactAmount = sliderValues[category] ??
            currentRec?.recommended_budget ??
            currentRec?.current_budget ??
            0;
          lockedMap[category] = Number(exactAmount);
        }
      });

      const payload = {
        total_budget: Number(totalBudget),
        period: period || 'Q4 2026',
        scenario_type: scenario,
        locked_categories: lockedMap,
      };
      const data = await api.post('/budget/optimize', payload);
      if (!data || !data.recommendations) {
        throw new Error('Backend returned empty recommendations');
      }
      setResults(data);
      const newSliderValues = { ...sliderValues };
      data.recommendations.forEach(rec => {
        const catName = rec.category_name || rec.name || rec.category;
        newSliderValues[catName] = rec.recommended_budget;
      });
      setSliderValues(newSliderValues);
      setSuccessMsg(`Optimization complete — calculated optimal distribution across ${data.recommendations.length} categories.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(`Optimization failed: ${err.message || 'Backend unavailable'}`);
    } finally {
      setOptimizing(false);
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
    if (!results || !results.recommendations) return;
    const values = {};
    results.recommendations.forEach(rec => { values[rec.category_name] = rec.recommended_budget; });
    setSliderValues(values);
    setLockedCategories({});
  };

  const approveAndApply = async () => {
    if (!results || !results.recommendations) return;
    setOptimizing(true);
    setErrorMsg('');
    try {
      const payload = {
        recommendations: results.recommendations.map(r => ({
          category_name: r.category_name || r.name,
          recommended_budget: sliderValues[r.category_name || r.name] ?? r.recommended_budget
        }))
      };
      await api.post('/budget/apply', payload);
      const updatedRecs = results.recommendations.map(r => {
        const catName = r.category_name || r.name;
        const newBudget = sliderValues[catName] ?? r.recommended_budget;
        return {
          ...r,
          current_budget: newBudget,
          recommended_budget: newBudget,
          change_percent: 0,
        };
      });
      setResults(prev => ({ ...prev, recommendations: updatedRecs }));
      setSuccessMsg('Approved! Applied new allocations as active Current Budget across all categories.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(`Failed to apply budget: ${err.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  // If backend failed and we have no results, render BackendError
  if (errorMsg && !results && !initialLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Budget Optimization
          </h1>
          <p className="text-slate-500 mt-1.5">
            AI-powered SLSQP constrained optimization across your organization's spending categories
          </p>
        </div>
        <BackendError
          title="Backend unavailable"
          message="Unable to connect to the FinSight API service to load or optimize budget allocations."
          error={errorMsg}
          onRetry={fetchInitialData}
          loading={initialLoading}
        />
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-primary-500 animate-spin" />
          <p className="text-slate-500 font-medium">Connecting to budget optimization service...</p>
        </div>
      </div>
    );
  }

  const totalAllocated = Object.values(sliderValues).reduce((a, b) => a + b, 0);
  const remaining = totalBudget - totalAllocated;
  const remainingPct = totalBudget > 0 ? (remaining / totalBudget) * 100 : 0;
  const lockedCount = Object.values(lockedCategories).filter(Boolean).length;

  const scenarioComparison = (results?.recommendations || []).map(r => {
    const base = Math.round((Number(r.current_budget) || 0) / 1000);
    const rec = Math.round((Number(r.recommended_budget) || base) / 1000);
    return {
      name: r.category_name || r.name,
      Conservative: Math.round(base * 0.98),
      Balanced: rec,
      Aggressive: Math.round(base * 1.15),
    };
  });

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
            disabled={optimizing}
            className="btn-primary"
          >
            {optimizing ? (
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

      {errorMsg && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-danger-800">Optimization Error</p>
            <p className="text-sm text-danger-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-4 flex items-center gap-3 animate-slide-down">
          <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-success-800">{successMsg}</p>
            <p className="text-sm text-success-700">Recommendations updated below.</p>
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

          {results && results.recommendations?.length > 0 && (
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
                  style={{ width: `${Math.min(100, totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0)}%` }}
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
                { l: 'Algorithm', v: 'SLSQP Non-Linear' },
                { l: 'Status', v: results ? 'Optimized' : 'Ready' },
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

      {results && results.recommendations?.length > 0 && (
        <div className="animate-fade-in space-y-8">
          <BudgetTable
            recommendations={results.recommendations}
            lockedCategories={lockedCategories}
            onToggleLock={toggleLock}
          />

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
                  key={rec.category_id || rec.id}
                  category={rec.category_name || rec.name}
                  value={sliderValues[rec.category_name || rec.name] ?? rec.recommended_budget}
                  min={Math.round((rec.current_budget || 10000) * 0.4)}
                  max={Math.round((rec.current_budget || 10000) * 1.6)}
                  isLocked={lockedCategories[rec.category_name || rec.name] || false}
                  onChange={(val) => handleSliderChange(rec.category_name || rec.name, val)}
                  onToggleLock={() => toggleLock(rec.category_name || rec.name)}
                  recommended={rec.recommended_budget}
                />
              ))}
            </div>

            <div className="mt-7 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={resetRecommendations} className="btn-outline">
                <RefreshCw className="w-4 h-4" />
                Reset to Recommendations
              </button>
              <button onClick={handleOptimize} disabled={optimizing} className="btn-secondary">
                <Calculator className="w-4 h-4" />
                Re-optimize with Locks
              </button>
              <button onClick={approveAndApply} disabled={optimizing} className="btn-primary">
                <CheckCircle2 className="w-4 h-4" />
                Approve & Apply
              </button>
            </div>
          </div>

          {scenarioComparison.length > 0 && (
            <TrendChart
              title="Scenario Comparison by Category"
              subtitle="Projected spend across Conservative, Balanced, and Aggressive scenarios (₹K)"
              data={scenarioComparison}
              xKey="name"
              yKeys={['Conservative', 'Balanced', 'Aggressive']}
              colors={['#0ea5e9', '#2563eb', '#c026d3']}
              type="bar"
              height={340}
            />
          )}
        </div>
      )}
    </div>
  );
}
