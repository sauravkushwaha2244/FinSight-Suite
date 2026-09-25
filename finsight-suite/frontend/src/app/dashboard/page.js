'use client';

import { useState, useEffect } from 'react';
import {
  Wallet, ShieldAlert, Bell, Brain, TrendingUp, Activity,
  AlertTriangle, CheckCircle, Clock, BarChart3, PieChart as PieIcon,
  RefreshCw, Sparkles, Filter, Download, ChevronDown
} from 'lucide-react';
import SummaryCard from '../../components/SummaryCard';
import TrendChart from '../../components/TrendChart';
import RiskAlertFeed from '../../components/RiskAlertFeed';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from 'recharts';
import { api } from '../../lib/api';

export default function DashboardPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState({
    budget: null,
    risk: null,
    loading: true,
    error: null
  });

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      const [budgetResult, riskResult] = await Promise.allSettled([
        api.get('/budget/recommendations'),
        api.get('/risk/dashboard')
      ]);
      const budgetRes = budgetResult.status === 'fulfilled' ? budgetResult.value : null;
      const riskRes = riskResult.status === 'fulfilled' ? riskResult.value : null;
      setData({
        budget: budgetRes,
        risk: riskRes,
        loading: false,
        error: budgetRes && riskRes ? null : 'Some dashboard data could not be loaded.'
      });
    } catch (err) {
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchDashboardData();
  }, []);

  const exportDashboard = () => {
    const blob = new Blob([JSON.stringify({ budget: data.budget, risk: data.risk }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finsight-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const spendTrendData = [
    { month: 'Apr', actual: 420, recommended: 450, forecast: 480 },
    { month: 'May', actual: 380, recommended: 420, forecast: 460 },
    { month: 'Jun', actual: 520, recommended: 500, forecast: 540 },
    { month: 'Jul', actual: 480, recommended: 510, forecast: 530 },
    { month: 'Aug', actual: 560, recommended: 550, forecast: 580 },
    { month: 'Sep', actual: 610, recommended: 590, forecast: 640 },
  ];

  const riskTrendData = [
    { month: 'Apr', score: 32, liquidity: 28, budget: 45 },
    { month: 'May', score: 28, liquidity: 24, budget: 40 },
    { month: 'Jun', score: 45, liquidity: 38, budget: 52 },
    { month: 'Jul', score: 38, liquidity: 32, budget: 44 },
    { month: 'Aug', score: 52, liquidity: 48, budget: 58 },
    { month: 'Sep', score: 45, liquidity: 42, budget: 50 },
  ];

  const categoryDistribution = [
    { name: 'Marketing', value: 250, color: '#2563eb' },
    { name: 'R&D', value: 280, color: '#0d9488' },
    { name: 'Operations', value: 470, color: '#c026d3' },
    { name: 'Sales', value: 180, color: '#d97706' },
    { name: 'HR', value: 120, color: '#dc2626' },
  ];

  const radarData = [
    { subject: 'Liquidity', A: 78, fullMark: 100 },
    { subject: 'Budget Var', A: 65, fullMark: 100 },
    { subject: 'Vendor', A: 82, fullMark: 100 },
    { subject: 'Forecast', A: 71, fullMark: 100 },
    { subject: 'Volatility', A: 58, fullMark: 100 },
  ];

  const recList = Array.isArray(data.budget) ? data.budget : (data.budget?.recommendations || []);
  const totalBudget = recList.length > 0 ? recList.reduce((acc, curr) => acc + (Number(curr.current_budget) || 0), 0) : 847000;
  const riskScore = data.risk?.latest_score?.composite_score ?? data.risk?.overall_score ?? 45.2;
  const riskSeverity = data.risk?.latest_score?.severity || data.risk?.severity || (riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low');
  const activeAlerts = [
    { id: 'a1', severity: 'critical', message: 'Vendor concentration risk exceeds 80% threshold — review top supplier contracts immediately', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
    { id: 'a2', severity: 'high', message: 'Q3 operational spend is trending 12% above recommended budget', created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: 'a3', severity: 'medium', message: 'Forecast deviation detected: R&D category MAE crossed $500', created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    { id: 'a4', severity: 'low', message: 'Weekly budget optimization completed successfully', created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    { id: 'a5', severity: 'medium', message: 'Market volatility indicator increased by 18% in the last 24h', created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
  ];

  const riskVariant = riskSeverity === 'critical' || riskSeverity === 'high' ? 'danger' : riskSeverity === 'medium' ? 'warning' : 'success';
  const riskLabel = `${riskSeverity.charAt(0).toUpperCase() + riskSeverity.slice(1)} Risk`;
  const alertsCritical = activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;

  const kpis = [
    {
      title: 'Total Budget',
      value: `₹${(totalBudget / 1000).toFixed(0)}K`,
      icon: Wallet,
      trend: '+12.4%',
      trendDirection: 'up',
      subtitle: 'vs last period',
      variant: 'default',
    },
    {
      title: 'Risk Score',
      value: riskScore.toFixed(1),
      icon: ShieldAlert,
      trend: riskLabel,
      trendDirection: 'flat',
      subtitle: 'Composite index',
      variant: riskVariant,
    },
    {
      title: 'Active Alerts',
      value: activeAlerts.length,
      icon: Bell,
      trend: `${alertsCritical} urgent`,
      trendDirection: alertsCritical > 0 ? 'down' : 'up',
      subtitle: 'Requires attention',
      variant: alertsCritical > 0 ? 'danger' : 'success',
    },
    {
      title: 'ML Model',
      value: '94.2%',
      icon: Brain,
      trend: 'R² Accuracy',
      trendDirection: 'up',
      subtitle: 'v2.4.1 XGBoost',
      variant: 'secondary',
    },
  ];

  const recentActivity = [
    { icon: RefreshCw, type: 'Optimization', message: 'Budget re-optimization completed for Q4 2026', time: '5 min ago', color: 'primary' },
    { icon: AlertTriangle, type: 'Alert', message: `New ${activeAlerts[0]?.severity || 'medium'} risk alert generated`, time: '30 min ago', color: 'danger' },
    { icon: Brain, type: 'ML', message: 'Nightly forecast inference ran successfully', time: '2 hours ago', color: 'accent' },
    { icon: CheckCircle, type: 'System', message: 'All risk indicators within acceptable range', time: '4 hours ago', color: 'success' },
    { icon: TrendingUp, type: 'Data', message: '1,284 new financial records ingested', time: '6 hours ago', color: 'secondary' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="badge-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
              Live Data
            </span>
            <span className="text-xs font-medium text-slate-400">
              Last updated: {mounted ? new Date().toLocaleTimeString() : '--:--:--'}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome back 👋
          </h1>
          <p className="text-slate-500 mt-1.5">
            Here's your organization's financial health overview for today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowFilters(value => !value)} className="btn-outline" aria-expanded={showFilters}>
            <Filter className="w-4 h-4" /> Filter
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
          <button onClick={exportDashboard} className="btn-outline">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={fetchDashboardData} disabled={refreshing} className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Dashboard data is scoped to the authenticated organization by the backend.
        </div>
      )}

      {data.error && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning-800">Partial data loaded</p>
            <p className="text-sm text-warning-700 mt-0.5">
              Some dashboard data couldn't be fetched from the API. Showing available cached and demo data.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((k, i) => (
          <div key={i} style={{ animationDelay: `${i * 0.05}s` }} className="animate-slide-up">
            <SummaryCard {...k} loading={data.loading} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <TrendChart
            title="Spend Performance vs Forecast"
            subtitle="Actual vs Recommended vs ML Forecast (₹K)"
            data={spendTrendData}
            xKey="month"
            yKeys={['actual', 'recommended', 'forecast']}
            type="area"
            height={360}
            action={
              <div className="flex gap-2">
                <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 border border-primary-100">6M</button>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">12M</button>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">YTD</button>
              </div>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TrendChart
              title="Risk Score Trend"
              subtitle="Composite and sub-indicators"
              data={riskTrendData}
              xKey="month"
              yKeys={['score', 'liquidity', 'budget']}
              colors={['#dc2626', '#2563eb', '#d97706']}
              type="line"
              height={280}
            />

            <div className="card p-6 lg:p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Budget Allocation</h3>
                  <p className="text-sm text-slate-500 mt-1">By category distribution</p>
                </div>
                <PieIcon className="w-5 h-5 text-slate-400" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {categoryDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 20px 48px -12px rgba(0,0,0,0.16)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {categoryDistribution.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium text-slate-600 truncate">{c.name}</span>
                    <span className="ml-auto font-bold text-slate-900">₹{c.value}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6 lg:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Risk Radar</h3>
                <p className="text-sm text-slate-500 mt-1">5-dimensional analysis</p>
              </div>
              <Activity className="w-5 h-5 text-danger-500" />
            </div>
            <div className="h-64 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickCount={3}
                  />
                  <Radar
                    name="Risk"
                    dataKey="A"
                    stroke="#dc2626"
                    fill="#dc2626"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6 lg:p-8">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Recent Activity</h3>
                <p className="text-sm text-slate-500 mt-1">System events</p>
              </div>
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              {recentActivity.map((a, i) => {
                const iconBg = {
                  primary: 'bg-primary-50 text-primary-600',
                  danger: 'bg-danger-50 text-danger-600',
                  accent: 'bg-accent-50 text-accent-600',
                  success: 'bg-success-50 text-success-600',
                  secondary: 'bg-secondary-50 text-secondary-600',
                }[a.color] || 'bg-slate-100 text-slate-600';
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                      <a.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{a.type}</span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">{a.time}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 mt-0.5 leading-snug">{a.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-6 lg:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Latest Risk Alerts</h3>
              <p className="text-sm text-slate-500 mt-1">Realtime notifications via Supabase</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger-500" />
              </span>
              <span className="text-xs font-semibold text-slate-500">Live</span>
            </div>
          </div>
          <RiskAlertFeed alerts={activeAlerts.slice(0, 5)} />
        </div>

        <div className="card p-6 lg:p-8 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 border-0 text-white relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-secondary-500/20 rounded-full blur-3xl" />
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-5">
              <Sparkles className="w-6 h-6 text-secondary-300" />
            </div>
            <h3 className="text-xl font-extrabold mb-2">Run AI Optimization</h3>
            <p className="text-sm text-primary-200 mb-6 leading-relaxed">
              Let our SLSQP engine crunch millions of combinations to find your optimal Q4 budget allocation across all departments.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl bg-white/10 border border-white/10 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-300">Time</p>
                <p className="text-lg font-bold mt-0.5">~12 sec</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/10 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-300">Accuracy</p>
                <p className="text-lg font-bold mt-0.5">94.2%</p>
              </div>
            </div>
            <button className="w-full btn bg-white text-primary-800 hover:bg-slate-100 shadow-large">
              <BarChart3 className="w-4 h-4" /> Optimize Budget Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
