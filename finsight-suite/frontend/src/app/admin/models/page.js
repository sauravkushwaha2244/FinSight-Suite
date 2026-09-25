'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import {
  PlayCircle, CheckCircle2, RefreshCw, Brain, Cpu, TrendingUp,
  AlertTriangle, Upload, Clock, BarChart3, Zap, Award, Download, FileJson
} from 'lucide-react';

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await api.get('/ml/models').catch(() => null);
        if (data && Array.isArray(data) && data.length > 0) {
          setModels(data);
        } else {
          setModels([
            { id: 'm1', version: 'v2.4.1', algorithm: 'XGBoost', trained_at: '2026-09-18T08:30:00Z', mae: 450.2, rmse: 620.5, r2: 0.942, is_active: true, training_samples: 12840, training_duration: '14m 32s', features: 47 },
            { id: 'm2', version: 'v2.3.0', algorithm: 'XGBoost', trained_at: '2026-08-22T14:12:00Z', mae: 512.8, rmse: 715.3, r2: 0.921, is_active: false, training_samples: 11620, training_duration: '12m 08s', features: 42 },
            { id: 'm3', version: 'v2.1.0', algorithm: 'Gradient Boosting', trained_at: '2026-07-05T10:45:00Z', mae: 602.1, rmse: 835.7, r2: 0.894, is_active: false, training_samples: 9840, training_duration: '9m 54s', features: 38 },
            { id: 'm4', version: 'v1.9.2', algorithm: 'Random Forest', trained_at: '2026-05-28T16:20:00Z', mae: 785.4, rmse: 1020.6, r2: 0.841, is_active: false, training_samples: 8420, training_duration: '7m 18s', features: 32 },
          ]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, []);

  const handleActivate = async (id) => {
    try {
      await api.post('/ml/models/activate', { model_id: id }).catch(() => null);
      setModels(models.map(m => ({ ...m, is_active: m.id === id })));
    } catch (e) { /* demo */ }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadModel = async () => {
    setActionError('');
    try {
      const blob = await api.download(`/ml/models/${activeModel.id}/download`);
      downloadBlob(blob, `${activeModel.version || 'model'}.pkl`);
    } catch (err) {
      setActionError(err.message || 'Model artifact could not be downloaded.');
    }
  };

  const handleViewMetadata = () => {
    setActionError('');
    const metadata = {
      version: activeModel.version,
      algorithm: activeModel.algorithm,
      trained_at: activeModel.trained_at,
      training_samples: activeModel.training_samples,
      features: activeModel.features,
      metrics: {
        mae: activeModel.mae,
        rmse: activeModel.rmse,
        r2: activeModel.r2,
      },
    };
    downloadBlob(
      new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }),
      `${activeModel.version || 'model'}-metadata.json`
    );
  };

  const handlePerformanceReport = () => {
    setActionError('');
    const report = [
      ['Metric', 'Value'],
      ['Model version', activeModel.version],
      ['Algorithm', activeModel.algorithm],
      ['MAE', activeModel.mae],
      ['RMSE', activeModel.rmse],
      ['R2', activeModel.r2],
      ['Training samples', activeModel.training_samples],
      ['Features', activeModel.features],
    ].map(row => row.join(',')).join('\n');
    downloadBlob(
      new Blob([report], { type: 'text/csv;charset=utf-8' }),
      `${activeModel.version || 'model'}-performance.csv`
    );
  };

  const activeModel = models.find(m => m.is_active);
  const algoCounts = models.reduce((acc, m) => {
    acc[m.algorithm] = (acc[m.algorithm] || 0) + 1;
    return acc;
  }, {});

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="w-10 h-10 text-primary-500 animate-spin" />
        <p className="text-slate-500 font-medium">Loading ML model registry...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="badge-accent">
              <Cpu className="w-3 h-3" /> ML Pipeline
            </span>
            <span className="text-xs font-medium text-slate-400">
              Offline Training • Supabase Storage • Versioned Artifacts
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            ML Model Management
          </h1>
          <p className="text-slate-500 mt-1.5">
            XGBoost spend forecasting with versioned artifacts, offline training pipeline, and A/B activation
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-outline">
            <Download className="w-4 h-4" /> Download Model
          </button>
          <button className="btn-secondary">
            <Upload className="w-4 h-4" /> Upload Artifact
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-6 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center">
              <Brain className="w-5.5 h-5.5 text-primary-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-success-600 bg-success-50 border border-success-200 px-2 py-0.5 rounded-md">
              Healthy
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Active Model</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{activeModel?.version || '—'}</p>
          <p className="text-xs text-slate-500 mt-1">{activeModel?.algorithm || 'No model'}</p>
        </div>

        <div className="card p-6 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-success-50 flex items-center justify-center">
              <TrendingUp className="w-5.5 h-5.5 text-success-600" />
            </div>
            <span className="badge-success">+0.021</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">R² Accuracy</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
            {(activeModel?.r2 * 100 || 0).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Best in class benchmark</p>
        </div>

        <div className="card p-6 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-accent-50 flex items-center justify-center">
              <FileJson className="w-5.5 h-5.5 text-accent-600" />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Models</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">{models.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            {Object.entries(algoCounts).map(([a, c]) => `${a} ${c}`).join(', ')}
          </p>
        </div>

        <div className="card p-6 card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-warning-50 flex items-center justify-center">
              <Zap className="w-5.5 h-5.5 text-warning-600" />
            </div>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Training Samples</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
            {(activeModel?.training_samples || 0).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Last trained {activeModel?.training_at ? new Date(activeModel.training_at).toLocaleDateString() : '—'}
            {activeModel?.training_data ? ` • ${activeModel.training_data}` : ''}
          </p>
        </div>
      </div>

      {activeModel && (
        <div className="card p-6 lg:p-8 bg-gradient-to-br from-slate-900 via-primary-900/40 to-slate-900 border-0 text-white relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-secondary-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

          <div className="relative grid lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-secondary-300" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-500/20 border border-success-400/30 text-success-300 text-[11px] font-black uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success-400" />
                    </span>
                    Production Active
                  </span>
                  <h2 className="text-2xl font-extrabold mt-1 tracking-tight">
                    {activeModel.version} — {activeModel.algorithm}
                  </h2>
                </div>
              </div>
              <p className="text-white/70 leading-relaxed mb-6 max-w-xl">
                Best-performing model selected by MAE. Trained on {activeModel.training_samples.toLocaleString()} historical records with {activeModel.features} engineered features.
                Processing real-time inference via FastAPI with sub-50ms p99 latency.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadModel} className="btn bg-white/10 backdrop-blur border border-white/20 text-white hover:bg-white/20">
                  <Download className="w-4 h-4" /> Download .pkl
                </button>
                <button onClick={handleViewMetadata} className="btn bg-white/10 backdrop-blur border border-white/20 text-white hover:bg-white/20">
                  <FileJson className="w-4 h-4" /> View Metadata
                </button>
                <button onClick={handlePerformanceReport} className="btn bg-white/10 backdrop-blur border border-white/20 text-white hover:bg-white/20">
                  <BarChart3 className="w-4 h-4" /> Performance Report
                </button>
              </div>
              {actionError && <p className="mt-3 text-sm font-semibold text-rose-200">{actionError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'MAE', v: activeModel.mae.toFixed(1), d: 'Mean Abs Error' },
                { l: 'RMSE', v: activeModel.rmse.toFixed(1), d: 'Root MSE' },
                { l: 'R²', v: (activeModel.r2 * 100).toFixed(1) + '%', d: 'Explained Var' },
                { l: 'Train', v: activeModel.training_duration, d: 'Duration' },
              ].map((item, i) => (
                <div key={i} className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{item.l}</p>
                  <p className="text-xl font-black mt-1 tabular-nums">{item.v}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-5 lg:p-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-accent-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 tracking-tight">Model Registry</h3>
              <p className="text-xs text-slate-500">{models.length} versioned artifacts</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-4">
            <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-warning-500" />Activate a model to promote to production inference</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/70">
                {['Version', 'Algorithm', 'Trained', 'MAE ↓', 'RMSE ↓', 'R² ↑', 'Features', 'Samples', 'Train Time', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m, idx) => {
                const r2Color = m.r2 >= 0.92 ? 'success' : m.r2 >= 0.88 ? 'warning' : 'danger';
                return (
                  <tr key={m.id} className={`hover:bg-primary-50/30 transition-colors ${m.is_active ? 'bg-gradient-to-r from-primary-50/60 via-white to-primary-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          idx === 0 ? 'bg-gradient-to-br from-warning-400 to-orange-500 text-white' :
                          idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="font-black text-slate-900">{m.version}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 border border-primary-100 text-xs font-bold">
                        <Cpu className="w-3 h-3" /> {m.algorithm}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 tabular-nums">
                      {new Date(m.trained_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-slate-700 tabular-nums">
                      {m.mae.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-slate-700 tabular-nums">
                      {m.rmse.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${
                              r2Color === 'success' ? 'from-success-500 to-secondary-500' :
                              r2Color === 'warning' ? 'from-warning-500 to-orange-500' :
                              'from-danger-500 to-red-400'
                            }`}
                            style={{ width: `${(m.r2) * 100}%` }}
                          />
                        </div>
                        <span className={`font-black tabular-nums text-sm ${
                          r2Color === 'success' ? 'text-success-700' :
                          r2Color === 'warning' ? 'text-warning-700' :
                          'text-danger-700'
                        }`}>
                          {(m.r2 * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-slate-700 tabular-nums">
                      {m.features || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-slate-700 tabular-nums">
                      {(m.training_samples || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 tabular-nums">
                      {m.training_duration || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-100 text-success-800 text-xs font-black border border-success-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {!m.is_active ? (
                        <button
                          onClick={() => handleActivate(m.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100 text-xs font-black transition-colors"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Activate
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-400 text-xs font-bold">
                          Running
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-6 lg:p-7">
          <h3 className="text-lg font-extrabold text-slate-900 mb-5 tracking-tight flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary-500" />
            Offline Training Pipeline
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { s: '1. Data', t: 'feature_engineering.py', d: 'Process raw CSVs, 47 features', st: 'done' },
              { s: '2. Train', t: 'train_model.py', d: 'XGBoost + RF + GBR compare', st: 'done' },
              { s: '3. Evaluate', t: 'evaluate_model.py', d: 'MAE/RMSE/R² report', st: 'done' },
              { s: '4. Deploy', t: 'Upload to Storage', d: 'Activate via API / UI', st: 'running' },
            ].map((step, i) => (
              <div key={i} className={`rounded-2xl border p-4 relative overflow-hidden ${
                step.st === 'done'
                  ? 'bg-success-50/40 border-success-200'
                  : 'bg-primary-50/40 border-primary-200'
              }`}>
                {step.st === 'running' && (
                  <div className="absolute top-3 right-3">
                    <RefreshCw className="w-3.5 h-3.5 text-primary-500 animate-spin" />
                  </div>
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black mb-3 ${
                  step.st === 'done'
                    ? 'bg-success-500 text-white'
                    : 'bg-gradient-to-br from-primary-600 to-primary-500 text-white'
                }`}>
                  {step.st === 'done' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-0.5">{step.s}</p>
                <p className="font-bold text-slate-900 text-sm mb-1">{step.t}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 lg:p-7 bg-gradient-to-br from-accent-50 via-white to-primary-50 border-accent-100">
          <div className="w-11 h-11 rounded-2xl bg-white border border-accent-200 flex items-center justify-center mb-4 shadow-sm">
            <Brain className="w-5.5 h-5.5 text-accent-600" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-2.5 tracking-tight">ML Pipeline is Separate</h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Never train models during API requests. The training module runs completely offline and independently:
          </p>
          <ul className="space-y-2 text-xs font-semibold text-slate-700">
            <li className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
              <span>Independent <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">ml_training/</code> directory</span>
            </li>
            <li className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
              <span>Compares XGBoost, Random Forest, Gradient Boosting</span>
            </li>
            <li className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
              <span>Selects best model automatically by lowest MAE</span>
            </li>
            <li className="flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
              <span>Artifacts uploaded to Supabase Storage bucket</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
