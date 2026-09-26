'use client';

import { useState, useEffect } from 'react';
import RiskGauge from '../../components/RiskGauge';
import RiskAlertFeed from '../../components/RiskAlertFeed';
import TrendChart from '../../components/TrendChart';
import BackendError from '../../components/BackendError';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
  ArrowUpRight, ArrowDownRight, Minus, ShieldAlert, Activity,
  Bell, RefreshCw, AlertTriangle, CheckCircle, Zap, Filter, Download
} from 'lucide-react';

export default function RiskPage() {
  const [data, setData] = useState({
    dashboard: null,
    alerts: [],
    loading: true,
    error: null,
  });
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const fetchRiskData = async () => {
    setRecalculating(true);
    try {
      await api.post('/risk/recalculate').catch(() => {});
      const [dashRes, alertsRes] = await Promise.all([
        api.get('/risk/dashboard'),
        api.get('/risk/alerts')
      ]);

      setData({
        dashboard: dashRes,
        alerts: Array.isArray(alertsRes) ? alertsRes : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setData({
        dashboard: null,
        alerts: [],
        loading: false,
        error: err.message || 'Backend unavailable',
      });
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
    try {
      const channel = supabase
        .channel('risk_alerts_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'risk_alerts' }, payload => {
          setData(prev => ({ ...prev, alerts: [payload.new, ...prev.alerts] }));
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } catch (e) {
      // Supabase realtime is optional
    }
  }, []);

  const handleAcknowledge = async (id) => {
    setData(prev => ({ ...prev, alerts: prev.alerts.filter(a => a.id !== id) }));
    try {
      await api.post(`/risk/alerts/${id}/acknowledge`);
    } catch (e) {
      console.warn('Acknowledge failed:', e);
    }
  };

  // If backend failed, show proper "Backend unavailable" error screen
  if (data.error && !data.dashboard) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Risk Intelligence
          </h1>
          <p className="text-slate-500 mt-1.5">
            Composite risk scoring, anomaly detection, and realtime alerting across your financial exposure
          </p>
        </div>
        <BackendError
          title="Backend unavailable"
          message="Unable to connect to the FinSight risk intelligence API. Composite risk scores and live alerts cannot be displayed."
          error={data.error}
          onRetry={fetchRiskData}
          loading={recalculating}
        />
      </div>
    );
  }

  if (data.loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-primary-500 animate-spin" />
          <p className="text-slate-500 font-medium">Loading risk intelligence module...</p>
        </div>
      </div>
    );
  }

  const overallScore = Number(data.dashboard?.latest_score?.composite_score ?? data.dashboard?.overall_score ?? 0);
  const overallSeverity = data.dashboard?.latest_score?.severity ?? data.dashboard?.severity ?? (overallScore >= 75 ? 'critical' : overallScore >= 50 ? 'high' : overallScore >= 25 ? 'medium' : 'low');

  // Derive the 5 canonical indicators from backend breakdown and latest_indicators
  const breakdown = data.dashboard?.breakdown || {};
  const rawIndicators = data.dashboard?.latest_indicators || {};

  const INDICATOR_CONFIG = [
    { key: 'liquidity', name: 'Liquidity', defaultRaw: 1.8, defaultScore: 20, defaultFmt: '1.80x', benchmark: '> 1.50x (Healthy)' },
    { key: 'budget_variance', name: 'Budget Variance', defaultRaw: 12.0, defaultScore: 35, defaultFmt: '12.0%', benchmark: '< 10.0% (Target)' },
    { key: 'vendor_concentration', name: 'Vendor Concentration', defaultRaw: 45.0, defaultScore: 45, defaultFmt: '45.0%', benchmark: '< 40.0% (Diversified)' },
    { key: 'forecast_deviation', name: 'Forecast Deviation', defaultRaw: 8.0, defaultScore: 25, defaultFmt: '8.0%', benchmark: '< 10.0% (Accurate)' },
    { key: 'volatility', name: 'Volatility', defaultRaw: 20.0, defaultScore: 30, defaultFmt: '20.0%', benchmark: '< 15.0% (Stable)' },
  ];

  const indicators = INDICATOR_CONFIG.map(cfg => {
    const bd = breakdown[cfg.key] || {};
    const histList = rawIndicators[cfg.key] || [];
    const latest = histList[0] || {};
    const prev = histList.length > 1 ? histList[1] : null;

    const riskScore = Math.round(Number(bd.risk_score ?? latest.value ?? cfg.defaultScore));
    const rawVal = Number(bd.raw_value ?? latest.value ?? cfg.defaultRaw);
    const formattedVal = bd.formatted_value || cfg.defaultFmt;
    const benchmark = bd.benchmark || cfg.benchmark;
    const status = bd.status || (riskScore < 25 ? 'Low Risk' : riskScore < 50 ? 'Moderate Risk' : riskScore < 75 ? 'Elevated Risk' : 'Critical Exposure');

    const diff = prev ? (rawVal - Number(prev.value)) : 0;
    const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const trendAmt = diff !== 0 ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}${cfg.key === 'liquidity' ? 'x' : '%'}` : 'Stable';

    return {
      key: cfg.key,
      name: bd.label || cfg.name,
      shortName: cfg.name,
      risk_score: riskScore,
      value: riskScore,
      raw_value: rawVal,
      formatted_value: formattedVal,
      benchmark,
      status,
      trend,
      trendAmt,
      desc: latest.period || 'Q4 2026',
    };
  });

  // Dynamic risk trend data derived from real indicators
  const riskTrend = indicators.map(ind => ({
    name: ind.shortName,
    'Risk Score': ind.risk_score,
    'Composite Posture': Math.round(overallScore),
  }));

  const severityCounts = {
    critical: data.alerts.filter(a => (a.severity || '').toLowerCase() === 'critical').length,
    high: data.alerts.filter(a => (a.severity || '').toLowerCase() === 'high').length,
    medium: data.alerts.filter(a => (a.severity || '').toLowerCase() === 'medium').length,
    low: data.alerts.filter(a => (a.severity || '').toLowerCase() === 'low').length,
  };

  const filteredAlerts = severityFilter === 'all' ? data.alerts : data.alerts.filter(a => (a.severity || '').toLowerCase() === severityFilter);

  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ dashboard: data.dashboard, alerts: data.alerts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finsight-risk-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className={`badge ${
              overallSeverity === 'critical' ? 'badge-danger' :
              overallSeverity === 'high' ? 'badge-warning' :
              overallSeverity === 'medium' ? 'badge-warning' : 'badge-success'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              Realtime Monitoring
            </span>
            <span className="text-xs font-medium text-slate-400">
              {indicators.length} active indicator categories
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Risk Intelligence
          </h1>
          <p className="text-slate-500 mt-1.5">
            Composite risk scoring, anomaly detection, and realtime alerting across your financial exposure
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowFilters(value => !value)} className="btn-outline" aria-expanded={showFilters}>
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button onClick={exportReport} className="btn-outline">
            <Download className="w-4 h-4" /> Export Report
          </button>
          <button onClick={fetchRiskData} disabled={recalculating} className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Choose a severity below to filter the active risk alert feed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 card p-6 lg:p-8 flex flex-col items-center justify-center">
          <h3 className="text-lg font-extrabold text-slate-900 mb-1 tracking-tight">Overall Risk Posture</h3>
          <p className="text-sm text-slate-500 mb-6">Composite score — 5 weighted dimensions</p>
          <RiskGauge score={overallScore} severity={overallSeverity} size="large" />
        </div>

        <div className="lg:col-span-3 card p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Alert Breakdown by Severity</h3>
              <p className="text-sm text-slate-500 mt-1">{data.alerts.length} total active alerts</p>
            </div>
            <Bell className="w-5 h-5 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
            {[
              { key: 'critical', label: 'Critical', count: severityCounts.critical, icon: AlertTriangle, color: 'danger' },
              { key: 'high', label: 'High', count: severityCounts.high, icon: ShieldAlert, color: 'warning' },
              { key: 'medium', label: 'Medium', count: severityCounts.medium, icon: Activity, color: 'warning' },
              { key: 'low', label: 'Low', count: severityCounts.low, icon: CheckCircle, color: 'success' },
            ].map(s => {
              const isActive = severityFilter === s.key;
              const countBgs = {
                danger: 'bg-gradient-to-br from-danger-500 to-danger-600',
                warning: 'bg-gradient-to-br from-warning-500 to-orange-500',
                success: 'bg-gradient-to-br from-success-500 to-secondary-500',
              };
              return (
                <button
                  key={s.key}
                  onClick={() => setSeverityFilter(isActive ? 'all' : s.key)}
                  className={`relative rounded-2xl p-4 lg:p-5 border transition-all duration-200 text-left ${
                    isActive
                      ? 'ring-2 ring-primary-500 border-primary-200 bg-primary-50/40 shadow-medium'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-soft'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      s.color === 'danger' ? 'bg-danger-50 text-danger-600' :
                      s.color === 'warning' ? 'bg-warning-50 text-warning-600' :
                      'bg-success-50 text-success-600'
                    }`}>
                      <s.icon className="w-4.5 h-4.5" />
                    </span>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg ${countBgs[s.color]}`}>
                      {s.count}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">Active Alerts</p>
                </button>
              );
            })}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Risk Exposure Distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 shadow-inner-soft">
              {['critical', 'high', 'medium', 'low'].map((key) => {
                const count = severityCounts[key] || 0;
                const total = Object.values(severityCounts).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const colors = {
                  critical: 'bg-gradient-to-r from-danger-600 to-danger-500',
                  high: 'bg-gradient-to-r from-orange-500 to-warning-500',
                  medium: 'bg-gradient-to-r from-warning-400 to-yellow-400',
                  low: 'bg-gradient-to-r from-success-500 to-secondary-500',
                };
                return pct > 0 ? (
                  <div key={key} className={`${colors[key]} h-full`} style={{ width: `${pct}%` }} title={`${key}: ${count} (${pct.toFixed(1)}%)`} />
                ) : null;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Monitored Risk Indicators</h3>
            <p className="text-sm text-slate-500 mt-1">Real-time indicators fetched from the financial intelligence engine</p>
          </div>
          <span className="badge badge-primary">
            <Zap className="w-3 h-3" /> Live
          </span>
        </div>
        {indicators.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {indicators.map((ind, idx) => {
              const score = ind.risk_score;
              const colorClass =
                score >= 75 ? 'from-danger-500 to-danger-600' :
                score >= 50 ? 'from-warning-500 to-orange-500' :
                score >= 25 ? 'from-primary-500 to-indigo-500' :
                'from-success-500 to-secondary-500';
              const bgClass =
                score >= 75 ? 'bg-danger-50/70 border-danger-200' :
                score >= 50 ? 'bg-warning-50/70 border-warning-200' :
                score >= 25 ? 'bg-slate-50/80 border-slate-200' :
                'bg-success-50/70 border-success-200';
              const TrendIcon = ind.trend === 'up' ? ArrowUpRight : ind.trend === 'down' ? ArrowDownRight : Minus;
              const trendColor =
                ind.trend === 'up' ? 'text-danger-600 bg-danger-100' :
                ind.trend === 'down' ? 'text-success-600 bg-success-100' :
                'text-slate-600 bg-slate-100';
              return (
                <div key={idx} className={`relative rounded-2xl border p-4 lg:p-5 card-hover overflow-hidden flex flex-col justify-between ${bgClass}`}>
                  <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br ${colorClass} opacity-10`} />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-bold text-slate-800 text-xs sm:text-sm leading-tight">{ind.name}</span>
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                        {ind.trendAmt}
                      </span>
                    </div>

                    <div className="flex items-end gap-1.5 mb-2.5">
                      <span className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">{score}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">/ 100</span>
                      <span className="ml-auto text-[11px] font-bold text-slate-600 mb-1">Risk</span>
                    </div>

                    <div className="h-1.5 bg-white/80 rounded-full overflow-hidden mb-3 border border-slate-200/50">
                      <div className={`h-full rounded-full bg-gradient-to-r ${colorClass}`} style={{ width: `${Math.min(100, Math.max(8, score))}%` }} />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Input Value:</span>
                        <span className="font-extrabold text-slate-900">{ind.formatted_value}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Status:</span>
                        <span className="font-semibold text-slate-700 truncate max-w-[110px]" title={ind.status}>{ind.status}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Safe:</span>
                        <span>{ind.benchmark}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            No indicators currently registered.
          </div>
        )}
      </div>

      {riskTrend.length > 0 && (
        <TrendChart
          title="Standardized Risk Scores vs Composite Posture"
          subtitle={`Comparing 5 standardized indicator risk scores (0-100) against composite risk (${Math.round(overallScore)} / 100)`}
          data={riskTrend}
          xKey="name"
          yKeys={['Risk Score', 'Composite Posture']}
          colors={['#2563eb', '#94a3b8']}
          type="bar"
          height={320}
        />
      )}

      <div className="card p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Active Risk Alerts</h3>
              {severityFilter !== 'all' && (
                <span className="badge badge-primary">
                  Filter: {severityFilter.charAt(0).toUpperCase() + severityFilter.slice(1)}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {filteredAlerts.length} of {data.alerts.length} total • Realtime notifications
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${severityFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All
            </button>
            {['critical', 'high', 'medium', 'low'].map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  severityFilter === s
                    ? s === 'critical' ? 'bg-danger-600 text-white' :
                      s === 'high' ? 'bg-orange-500 text-white' :
                      s === 'medium' ? 'bg-warning-500 text-white' :
                      'bg-success-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s} ({severityCounts[s]})
              </button>
            ))}
          </div>
        </div>
        {filteredAlerts.length > 0 ? (
          <RiskAlertFeed alerts={filteredAlerts} onAcknowledge={handleAcknowledge} />
        ) : (
          <div className="py-12 text-center">
            <CheckCircle className="w-10 h-10 text-success-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-800">No active alerts</p>
            <p className="text-xs text-slate-400 mt-1">All monitored dimensions are within configured safety margins.</p>
          </div>
        )}
      </div>
    </div>
  );
}
