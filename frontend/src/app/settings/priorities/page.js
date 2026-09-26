'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Target, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api';
import BackendError from '../../../components/BackendError';

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('Q4 2026');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPriorities = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.get('/budget/priorities');
      if (Array.isArray(data)) {
        setPriorities(data.map(p => ({
          id: p.id,
          name: p.priority_name || p.name,
          weight: Number(p.weight) || 0,
          description: p.description || ''
        })));
      } else {
        setPriorities([]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Backend unavailable');
      setPriorities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    if (priorities.length === 0) return;
    const each = Math.floor(100 / priorities.length);
    const remainder = 100 - (each * priorities.length);
    setPriorities(priorities.map((p, i) => ({
      ...p,
      weight: i === 0 ? each + remainder : each
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        period,
        priorities: priorities.map(p => ({
          id: p.id,
          priority_name: p.name || p.priority_name,
          weight: Number(p.weight),
          description: p.description || '',
        }))
      };
      await api.post('/budget/priorities', payload);
      setSuccessMsg('Priority weights saved and applied to optimization engine');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(`Save failed: ${err.message || 'Backend unavailable'}`);
    } finally {
      setSaving(false);
    }
  };

  if (errorMsg && priorities.length === 0 && !loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Business Priorities
          </h1>
          <p className="text-slate-500 mt-1.5">
            Configure strategic priority weights to guide the budget optimization model
          </p>
        </div>
        <BackendError
          title="Backend unavailable"
          message="Unable to connect to the backend service to retrieve business priorities."
          error={errorMsg}
          onRetry={fetchPriorities}
          loading={loading}
        />
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <RefreshCw className="w-10 h-10 text-primary-500 animate-spin" />
    </div>
  );

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

      {errorMsg && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <p className="font-bold text-danger-800">{errorMsg}</p>
        </div>
      )}

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

      <div className="card p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600" />
              Weight Allocation ({period})
            </h3>
            <p className="text-xs text-slate-500 mt-1">Total allocation must equal exactly 100%.</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={distributeEvenly} className="btn-outline text-xs">
              Distribute Evenly
            </button>
            <div className={`px-4 py-2 rounded-xl text-sm font-black border tabular-nums ${
              weightValid ? 'bg-success-50 text-success-700 border-success-200' : 'bg-danger-50 text-danger-700 border-danger-200'
            }`}>
              {totalWeight}% / 100%
            </div>
          </div>
        </div>

        {priorities.length > 0 ? (
          <div className="space-y-6">
            {priorities.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => handleNameChange(p.id, e.target.value)}
                    className="font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={p.weight}
                      onChange={(e) => handleWeightChange(p.id, e.target.value)}
                      className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-right font-black text-slate-900"
                    />
                    <span className="text-sm font-bold text-slate-500">%</span>
                    <button
                      onClick={() => removePriority(p.id)}
                      disabled={priorities.length <= 1}
                      className="p-1.5 text-slate-400 hover:text-danger-600 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={p.description}
                  onChange={(e) => handleDescriptionChange(p.id, e.target.value)}
                  placeholder="Priority rationale or description"
                  className="w-full text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={p.weight}
                  onChange={(e) => handleWeightChange(p.id, e.target.value)}
                  className="w-full accent-primary-600 cursor-pointer"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-400">
            No priorities configured. Click "Add Priority" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
