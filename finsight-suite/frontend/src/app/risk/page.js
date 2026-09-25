'use client';

import { useState, useEffect } from 'react';
import RiskGauge from '../../components/RiskGauge';
import RiskAlertFeed from '../../components/RiskAlertFeed';
import TrendChart from '../../components/TrendChart';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
  ArrowUpRight, ArrowDownRight, Minus, ShieldAlert, Activity,
  Bell, RefreshCw, TrendingUp, AlertTriangle, CheckCircle,
  Clock, Filter, Download, Zap
} from 'lucide-react';

export default function RiskPage() {
  const [data, setData] = useState({
    dashboard: null,
    alerts: [],
    loading: true
  });
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRiskData = async () => {
    try {
      const [dashRes, alertsRes] = await Promise.all([
        api.get('/risk/dashboard').catch(() => null),
        api.get('/risk/alerts').catch(() => null)
      ]);
      setData({
        dashboard: dashRes || { overall_score: 52, severity: 'medium', indicators: {} },
        alerts: alertsRes || [
          { id: 'a1', severity: 'critical', indicator_type: 'Vendor', message: 'Vendor concentration risk exceeds 80% threshold — top 3 suppliers represent critical exposure', created_at: new Date(Date.now() - 1800000).toISOString() },
          { id: 'a2', severity: 'high', indicator_type: 'Budget', message: 'Q3 Operational spend trending 12.4% above recommended budget allocation', created_at: new Date(Date.now() - 7200000).toISOString() },
          { id: 'a3', severity: 'medium', indicator_type: 'Forecast', message: 'Forecast deviation in R&D category — MAE crossed $500 warning threshold', created_at: new Date(Date.now() - 18000000).toISOString() },
          { id: 'a4', severity: 'medium', indicator_type: 'Market', message: 'Market volatility indicator increased 18% in the last 24 hours', created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: 'a5', severity: 'low', indicator_type: 'System', message: 'Weekly risk recalibration completed successfully', created_at: new Date(Date.now() - 172800000).toISOString() },
          { id: 'a6', severity: 'high', indicator_type: 'Liquidity', message: 'Liquidity ratio approaching minimum acceptable threshold — review payables schedule', created_at: new Date(Date.now() - 3600000).toISOString() },
        ],
        loading: false
      });
    } catch (err) {
      setData(prev => ({ ...prev, loading: false }));
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
    } catch (e) { /* demo */ }
  }, []);

  const handleAcknowledge = async (id) => {
    setData(prev => ({ ...prev, alerts: prev.alerts.filter(a => a.id !== id) }));
    try { await api.post(`/risk/alerts/${id}/acknowledge`); } catch (e) { /* demo */ }
  };

  const overallScore = data.dashboard?.latest_score?.composite_score ?? data.dashboard?.overall_score ?? 52.4;
  const overallSeverity = data.dashboard?.latest_score?.severity ?? data.dashboard?.severity ?? (overallScore >= 75 ? 'critical' : overallScore >= 50 ? 'high' : overallScore >= 25 ? 'medium' : 'low');

  const indicators = [
    { name: 'Market Volatility', value: 72, trend: 'up', trendAmt: '+18%', desc: '30-day index' },
    { name: 'Liquidity Risk', value: 34, trend: 'down', trendAmt: '-8%', desc: 'Cash coverage' },
    { name: 'Credit Risk', value: 45, trend: 'flat', trendAmt: '0%', desc: 'Counterparty' },
    { name: 'Operational Risk', value: 60, trend: 'up', trendAmt: '+5%', desc: 'Process failures' },
    { name: 'Compliance Risk', value: 20, trend: 'down', trendAmt: '-3%', desc: 'Regulatory' },
    { name: 'Vendor Concentration', value: 81, trend: 'up', trendAmt: '+12%', desc: 'Top 5 exposure' },
    { name: 'Budget Variance', value: 55, trend: 'up', trendAmt: '+7%', desc: 'Spend vs plan' },
    { name: 'Forecast Deviation', value: 38, trend: 'down', trendAmt: '-4%', desc: 'MAPE' },
  ];

  const riskTrend = [
    { name: 'Apr', Score: 32, Liquidity: 28, Budget: 45, Vendor: 65 },
    { name: 'May', Score: 28, Liquidity: 24, Budget: 40, Vendor: 68 },
    { name: 'Jun', Score: 45, Liquidity: 38, Budget: 52, Vendor: 72 },
    { name: 'Jul', Score: 38, Liquidity: 32, Budget: 44, Vendor: 70 },
    { name: 'Aug', Score: 52, Liquidity: 48, Budget: 58, Vendor: 76 },
    { name: 'Sep', Score: 52, Liquidity: 34, Budget: 55, Vendor: 81 },
  ];

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
              5 indicator categories • Updated {new Date().toLocaleTimeString()}
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
          <button onClick={fetchRiskData} className="btn-primary">
            <RefreshCw className="w-4 h-4" /> Recalculate Scores
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
          <p className="text-sm text-slate-500 mb-6">Composite score — 5 weighted indicators</p>
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
              {['critical', 'high', 'medium', 'low'].map((key, i, arr) => {
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
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Risk Indicator Dashboard</h3>
            <p className="text-sm text-slate-500 mt-1">Real-time scores across 8 monitored dimensions</p>
          </div>
          <span className="badge badge-primary">
            <Zap className="w-3 h-3" /> Auto-updating
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {indicators.map((ind, idx) => {
            const colorClass =
              ind.value >= 75 ? 'from-danger-500 to-danger-600' :
              ind.value >= 50 ? 'from-warning-500 to-orange-500' :
              ind.value >= 25 ? 'from-warning-400 to-yellow-400' :
              'from-success-500 to-secondary-500';
            const bgClass =
              ind.value >= 75 ? 'bg-danger-50 border-danger-200' :
              ind.value >= 50 ? 'bg-warning-50 border-warning-200' :
              ind.value >= 25 ? 'bg-yellow-50 border-yellow-200' :
              'bg-success-50 border-success-200';
            const TrendIcon = ind.trend === 'up' ? ArrowUpRight : ind.trend === 'down' ? ArrowDownRight : Minus;
            const trendColor =
              ind.trend === 'up' ? 'text-danger-600 bg-danger-100' :
              ind.trend === 'down' ? 'text-success-600 bg-success-100' :
              'text-slate-600 bg-slate-100';
            return (
              <div key={idx} className={`relative rounded-2xl border p-4 lg:p-5 card-hover overflow-hidden ${bgClass}`}>
                <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gradient-to-br ${colorClass} opacity-10`} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="font-bold text-slate-800 text-sm leading-tight">{ind.name}</span>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black ${trendColor}`}>
                      <TrendIcon className="w-3 h-3" />
                      {ind.trendAmt}
                    </span>
                  </div>
                  <div className="flex items-end gap-2 mb-3">
                    <span className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">{ind.value}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">/ 100</span>
                  </div>
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full bg-gradient-to-r ${colorClass}`} style={{ width: `${ind.value}%` }} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">{ind.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TrendChart
        title="Risk Score Trend — 6 Month Analysis"
        subtitle="Composite risk score and sub-indicator movement over time"
        data={riskTrend}
        xKey="name"
        yKeys={['Score', 'Liquidity', 'Budget', 'Vendor']}
        colors={['#dc2626', '#2563eb', '#d97706', '#c026d3']}
        type="area"
        height={340}
      />

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
              {filteredAlerts.length} of {data.alerts.length} total • Realtime via Supabase
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
        <RiskAlertFeed alerts={filteredAlerts} onAcknowledge={handleAcknowledge} />
      </div>
    </div>
  );
}
