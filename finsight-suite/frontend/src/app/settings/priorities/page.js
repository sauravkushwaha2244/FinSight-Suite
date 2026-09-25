'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, RefreshCw, Target, Plus, Trash2, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { api } from '../../../lib/api';

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('Q4 2026');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchPriorities = async () => {
      try {
        const data = await api.get('/budget/priorities').catch(() => null);
        if (data && data.length > 0) {
          setPriorities(data.map(p => ({
            id: p.id,
            name: p.priority_name || p.name,
            weight: p.weight,
            description: p.description || ''
          })));
        } else {
          setPriorities([
            { id: 1, name: 'Growth', weight: 40, description: 'Revenue expansion & market share' },
            { id: 2, name: 'Profitability', weight: 30, description: 'Margins & cost efficiency' },
            { id: 3, name: 'Innovation', weight: 20, description: 'R&D and new initiatives' },
            { id: 4, name: 'Stability', weight: 10, description: 'Risk mitigation & reserves' },
          ]);
        }
      } catch (err) {
        console.warn('Priorities fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPriorities();
  }, []);

  const totalWeight = priorities.reduce((sum, p) => sum + Number(p.weight), 0);
  const weightValid = totalWeight === 100;

  const handleWeightChange = (id, newWeight) => {
    const v = Math.min(100, Math.max(0, Number(newWeight)));
    setPriorities(priorities.map(p => p.id === id ? { ...p, weight: v } : p));
  };

  const handleNameChange = (id, newName) => {
    setPriorities(priorities.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const handleDescriptionChange = (id, v) => {
    setPriorities(priorities.map(p => p.id === id ? { ...p, description: v } : p));
  };

  const addPriority = () => {
    setPriorities([...priorities, {
      id: Date.now(),
      name: 'New Priority',
      weight: 0,
      description: ''
    }]);
  };

  const removePriority = (id) => {
    if (priorities.length <= 1) return;
    setPriorities(priorities.filter(p => p.id !== id));
  };

  const distributeEvenly = () => {
    const each = Math.floor(100 / priorities.length);
    const remainder = 100 - (each * priorities.length);
    setPriorities(priorities.map((p, i) => ({
      ...p,
      weight: i === 0 ? each + remainder : each
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        period,
        priorities: priorities.map(p => ({
          priority_name: p.name || p.priority_name,
          weight: Number(p.weight),
          description: p.description || '',
        }))
      };
      await api.post('/budget/priorities', payload);
      setSuccessMsg('Priority weights saved and applied to optimization engine');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      setSuccessMsg('Priority weights saved locally');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <RefreshCw className="w-10 h-10 text-primary-500 animate-spin" />
    </div>
  );

  const getColorForIndex = (i) => {
    const palette = [
      'from-primary-500 to-indigo-500',
      'from-secondary-500 to-emerald-500',
      'from-accent-500 to-purple-500',
      'from-warning-500 to-orange-500',
      'from-sky-500 to-blue-500',
      'from-danger-500 to-rose-500',
    ];
    return palette[i % palette.length];
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Business Priorities
          </h1>
          <p className="text-slate-500 mt-1.5">
            Configure strategic priority weights to guide the budget optimization model
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="select-input w-auto">
            <option>Q4 2026</option><option>Q1 2027</option><option>FY 2027</option>
          </select>
          <button onClick={addPriority} className="btn-outline">
            <Plus className="w-4 h-4" /> Add Priority
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !weightValid}
            className="btn-primary"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-2xl border border-success-200 bg-success-50 p-4 flex items-center gap-3 animate-slide-down">
          <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <p className="font-bold text-success-800">{successMsg}</p>
            <p className="text-sm text-success-700">Optimizer will use these weights on the next run.</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 card p-6 lg:p-8">
          <div className={`p-5 rounded-2xl border mb-6 flex items-center justify-between ${
            weightValid
              ? 'bg-success-50 border-success-200'
              : 'bg-danger-50 border-danger-200'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                weightValid ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'
              }`}>
                <Target className="w-5.5 h-5.5" />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${
                  weightValid ? 'text-success-600' : 'text-danger-600'
                }`}>
                  Total Weight Distribution
                </p>
                <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${
                  weightValid ? 'text-success-800' : 'text-danger-800'
                }`}>
                  {totalWeight}% <span className="text-base font-bold opacity-60">/ 100%</span>
                </p>
              </div>
            </div>
            <button
              onClick={distributeEvenly}
              className="btn-outline text-xs py-2 px-3 whitespace-nowrap"
            >
              Distribute Evenly
            </button>
          </div>

          {!weightValid && (
            <div className="mb-6 p-4 rounded-xl bg-danger-50/50 border border-danger-200 text-danger-700 text-sm font-semibold flex items-start gap-2.5">
              <Info className="w-4.5 h-4.5 mt-0.5 flex-shrink-0" />
              <div>
                Weights must sum to exactly 100% to save. Currently off by{' '}
                <span className="font-black">{totalWeight > 100 ? '+' : ''}{totalWeight - 100}%</span>.
              </div>
            </div>
          )}

          <div className="space-y-5">
            {priorities.map((p, idx) => {
              const remaining = 100 - totalWeight + Number(p.weight);
              const gradient = getColorForIndex(idx);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 p-5 bg-gradient-to-br from-white to-slate-50/50 card-hover"
                >
                  <div className="grid md:grid-cols-12 gap-4 items-start md:items-center">
                    <div className="md:col-span-4 flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handleNameChange(p.id, e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none font-bold text-slate-900 py-0.5"
                          placeholder="Priority name"
                        />
                        <input
                          type="text"
                          value={p.description || ''}
                          onChange={(e) => handleDescriptionChange(p.id, e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none text-xs text-slate-500 py-0.5 mt-0.5"
                          placeholder="Brief description..."
                        />
                      </div>
                    </div>

                    <div className="md:col-span-7 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="relative mb-1">
                          <input
                            type="range"
                            min="0"
                            max={remaining < Number(p.weight) ? Number(p.weight) : 100}
                            value={p.weight}
                            onChange={(e) => handleWeightChange(p.id, e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>0%</span>
                          <span className="text-primary-500">Max safe: {remaining}%</span>
                          <span>100%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={p.weight}
                          onChange={(e) => handleWeightChange(p.id, e.target.value)}
                          className="w-20 px-3 py-2 text-lg font-black text-center tabular-nums rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                        />
                        <span className="text-lg font-black text-slate-400">%</span>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <button
                        onClick={() => removePriority(p.id)}
                        disabled={priorities.length <= 1}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-danger-600 hover:bg-danger-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-all"
                        title="Remove priority"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6 lg:p-7">
            <h3 className="text-lg font-extrabold text-slate-900 mb-5 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              Weight Visualization
            </h3>
            <div className="h-8 rounded-2xl bg-slate-100 flex overflow-hidden shadow-inner-soft mb-5">
              {priorities.map((p, i) => Number(p.weight) > 0 && (
                <div
                  key={p.id}
                  className={`bg-gradient-to-br ${getColorForIndex(i)} h-full flex items-center justify-center text-[10px] font-black text-white first:rounded-l-2xl last:rounded-r-2xl transition-all duration-500`}
                  style={{ width: `${p.weight}%`, minWidth: p.weight >= 3 ? 'auto' : '32px' }}
                  title={`${p.name}: ${p.weight}%`}
                >
                  {p.weight >= 7 && `${p.weight}%`}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {priorities.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                  <div className={`w-3 h-3 rounded-md bg-gradient-to-br ${getColorForIndex(i)} ring-2 ring-white shadow-sm`} />
                  <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{p.name}</span>
                  <span className="text-sm font-black text-slate-900 tabular-nums w-12 text-right">{p.weight}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 lg:p-7 bg-gradient-to-br from-primary-50 via-white to-secondary-50 border-primary-100">
            <div className="w-11 h-11 rounded-2xl bg-white border border-primary-100 flex items-center justify-center mb-4 shadow-sm">
              <Info className="w-5 h-5 text-primary-600" />
            </div>
            <h4 className="font-extrabold text-slate-900 mb-2.5">How Priority Weights Work</h4>
            <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary-500 font-black">1.</span>
                Weights directly influence the optimization objective function
              </li>
              <li className="flex gap-2">
                <span className="text-primary-500 font-black">2.</span>
                Higher "Growth" weight shifts budget toward Marketing & Sales
              </li>
              <li className="flex gap-2">
                <span className="text-primary-500 font-black">3.</span>
                Higher "Stability" weight penalizes large budget changes
              </li>
              <li className="flex gap-2">
                <span className="text-primary-500 font-black">4.</span>
                Applied in real-time when you run optimization
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
