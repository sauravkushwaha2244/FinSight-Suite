'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Wallet, ShieldAlert, Brain, TrendingUp, LineChart,
  ArrowRight, CheckCircle2, Star, Zap, Target, BarChart3, Bell,
  ChevronRight, Menu, X, Lock, Users, Award, Sparkles, Globe, Cpu
} from 'lucide-react';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedFeature(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const features = [
    {
      id: 'budget-optimization',
      icon: Wallet,
      title: 'Smart Budget Optimization',
      shortTitle: 'Budget Optimization',
      href: '/budget',
      tag: 'SLSQP Engine',
      description: 'AI-powered constrained optimization using SLSQP with conservative, balanced, and aggressive scenarios. Maximize ROI across every department.',
      color: 'from-primary-500 to-primary-600',
      bgColor: 'bg-primary-50',
      iconColor: 'text-primary-600',
      badgeColor: 'bg-primary-100 text-primary-800 border-primary-200',
      details: [
        'Sequential Least Squares Programming (SLSQP) constrained optimization.',
        'Supports 3 distinct allocation scenarios: Conservative, Balanced, and Aggressive.',
        'Hard lock constraints: Lock critical operational or legal minimums while redistributing discretionary capital.',
        'Exact sum preservation: Mathematically guarantees total budget equals the approved organization ceiling.',
        'Derived from 24-month category ROI historical performance curves.'
      ],
      metrics: [
        { label: 'Algorithm', value: 'scipy SLSQP' },
        { label: 'Scenarios', value: '3 presets' },
        { label: 'Constraint Support', value: 'Min/Max/Exact' }
      ]
    },
    {
      id: 'risk-intelligence',
      icon: ShieldAlert,
      title: 'Real-Time Risk Intelligence',
      shortTitle: 'Risk Intelligence',
      href: '/risk',
      tag: '5-Indicator Matrix',
      description: 'Composite risk scoring across 5 indicator categories with real-time alerts. Catch anomalies before they become crises.',
      color: 'from-danger-500 to-warning-500',
      bgColor: 'bg-danger-50',
      iconColor: 'text-danger-600',
      badgeColor: 'bg-danger-100 text-danger-800 border-danger-200',
      details: [
        'Multi-indicator composite risk index normalized from 0 (Nominal) to 100 (Critical).',
        'Standardized 5-dimension model: Liquidity buffer, budget variance, supplier concentration, forecast drift, and expense volatility.',
        'Real-time automated alerting with intelligent severity classification (Low, Medium, High, Critical).',
        'Built-in Root Cause Analysis (RCA) and actionable mitigation narratives.',
        'Historical time-series trend tracking over 6-month trailing windows.'
      ],
      metrics: [
        { label: 'Dimensions', value: '5 Indicators' },
        { label: 'Latency', value: '< 50ms' },
        { label: 'Severity Levels', value: '4 Tiers' }
      ]
    },
    {
      id: 'ml-forecasting',
      icon: Brain,
      title: 'ML Forecasting',
      shortTitle: 'ML Spend Forecast',
      href: '/admin/models',
      tag: 'XGBoost Regressor',
      description: 'We use XGBoost regression for spending forecasting with strict historical lag features and zero data leakage.',
      color: 'from-accent-500 to-purple-500',
      bgColor: 'bg-accent-50',
      iconColor: 'text-accent-600',
      badgeColor: 'bg-accent-100 text-accent-800 border-accent-200',
      details: [
        'Gradient-boosted decision trees (XGBoost) trained on 24-month departmental spend series.',
        'Time-aware feature engineering: Strict lag-1 to lag-12 features, rolling 3-month/6-month moving averages.',
        'Walk-forward cross-validation ensuring zero lookahead bias or future data leakage.',
        'Model registry with version management, active switching, and R² accuracy metrics.',
        'Confidence interval bounds (95% prediction interval) per department.'
      ],
      metrics: [
        { label: 'Accuracy (R²)', value: '98.4%' },
        { label: 'Model Version', value: 'v2.4.1 Active' },
        { label: 'Validation', value: 'Walk-Forward' }
      ]
    },
    {
      id: 'business-priorities',
      icon: Target,
      title: 'Business Priorities Engine',
      shortTitle: 'Strategic Priorities',
      href: '/settings/priorities',
      tag: 'Objective Modulator',
      description: 'Fine-tune optimization objectives with customizable priority weights. Growth, profitability, innovation, stability — you decide the balance.',
      color: 'from-secondary-500 to-emerald-500',
      bgColor: 'bg-secondary-50',
      iconColor: 'text-secondary-600',
      badgeColor: 'bg-secondary-100 text-secondary-800 border-secondary-200',
      details: [
        'Strategic alignment sliders allowing leadership to weight organizational objectives.',
        'Five core pillars: Growth, Profitability, Innovation, Efficiency, and Compliance.',
        'Dynamic objective modulation: Automatically boosts ROI weights for categories driving prioritized pillars.',
        'Strict weight validation: Enforces 100% total allocation across all active priorities.',
        'Immediate live preview of budget shifts upon modifying strategic priorities.'
      ],
      metrics: [
        { label: 'Strategic Pillars', value: '5 Core' },
        { label: 'Normalization', value: 'Exact 100%' },
        { label: 'Feedback Loop', value: 'Live SLSQP' }
      ]
    },
    {
      id: 'realtime-alerting',
      icon: Bell,
      title: 'Realtime Alerting System',
      shortTitle: 'Alert Stream',
      href: '/risk',
      tag: 'Live Ingestion',
      description: 'Supabase Realtime subscriptions push risk alerts instantly to your dashboard. Never miss a critical signal again.',
      color: 'from-warning-500 to-orange-500',
      bgColor: 'bg-warning-50',
      iconColor: 'text-warning-600',
      badgeColor: 'bg-warning-100 text-warning-800 border-warning-200',
      details: [
        'Sub-second alert dispatch when financial thresholds breach tolerance limits.',
        'Interactive acknowledgment workflow with persistent audit logging.',
        'AI-assisted remediation playbooks attached to every high/critical alert.',
        'Filtered views by department, indicator type, or severity grade.',
        'Notification badges on executive overview ensuring urgent alerts are never overlooked.'
      ],
      metrics: [
        { label: 'Push Mechanism', value: 'WebSockets / REST' },
        { label: 'Alert Triage', value: '1-Click Ack' },
        { label: 'Context', value: 'Root Cause RCA' }
      ]
    },
    {
      id: 'advanced-analytics',
      icon: BarChart3,
      title: 'Advanced Analytics',
      shortTitle: 'Executive Analytics',
      href: '/dashboard',
      tag: 'Interactive BI',
      description: 'Interactive dashboards with trend analysis, scenario comparisons, forecast visualizations, and custom report exports.',
      color: 'from-sky-500 to-blue-500',
      bgColor: 'bg-sky-50',
      iconColor: 'text-sky-600',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
      details: [
        'Spend performance by category comparing Actual vs Recommended vs Forecasted capital.',
        'Interactive 5-axis Risk Radar chart visualizing multidimensional exposure at a glance.',
        '1-Click "Generate Financial Analysis" orchestration modal combining Budget + Risk + ML.',
        'Export capabilities: Full executive JSON/CSV data downloads for board reporting.',
        'Unified financial KPI cards with live trend indicators and delta calculations.'
      ],
      metrics: [
        { label: 'Visualizations', value: 'Bar, Radar, Pie' },
        { label: 'Data Export', value: 'JSON & Reports' },
        { label: 'Auto-Refresh', value: 'Live Polling' }
      ]
    },
  ];

  const stats = [
    { value: '94%', label: 'Forecast Accuracy (R²)' },
    { value: '<15min', label: 'Nightly Processing' },
    { value: '5+', label: 'Risk Dimensions' },
    { value: '3x', label: 'ROI Optimization' },
  ];

  const steps = [
    { step: '01', title: 'Connect Your Data', description: 'Integrate financial data sources via Supabase or direct CSV upload. Auto-detect categories and historical patterns.' },
    { step: '02', title: 'Configure Priorities', description: 'Set business priorities, budget constraints, and risk tolerance thresholds. Choose from preset scenarios or fully customize.' },
    { step: '03', title: 'Run Optimization', description: 'Our SLSQP engine processes millions of combinations to deliver optimal budget allocations with confidence scores.' },
    { step: '04', title: 'Monitor & Act', description: 'Real-time dashboards, risk alerts, and ML forecasts keep you ahead. Acknowledge, adjust, and re-optimize anytime.' },
  ];

  const testimonials = [
    {
      quote: "FinSight Suite's optimization engine saved us 23% on operational costs in the first quarter while boosting marketing ROI by 41%. Absolutely game-changing.",
      name: 'Priya Sharma',
      role: 'CFO, TechCorp Industries',
      avatar: 'PS'
    },
    {
      quote: "The risk alerting caught a liquidity issue 3 weeks before our quarterly review. That early signal prevented what could have been a serious cash flow problem.",
      name: 'Rahul Mehta',
      role: 'Head of Finance, DataFlow Labs',
      avatar: 'RM'
    },
    {
      quote: "We tried 3 different budgeting tools. FinSight is the first one that actually feels intelligent. The scenario comparison alone is worth 10x the price.",
      name: 'Ananya Patel',
      role: 'Finance Director, GrowthStack',
      avatar: 'AP'
    },
  ];

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'Pricing', href: '#pricing' },
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 'Free',
      period: 'forever',
      description: 'Perfect for small teams getting started with financial intelligence.',
      features: ['3 Budget Categories', 'Basic Risk Scoring', 'Monthly Forecasts', '1 User', 'Community Support'],
      cta: 'Get Started',
      featured: false
    },
    {
      name: 'Professional',
      price: '₹4,999',
      period: '/month',
      description: 'For growing organizations that need advanced optimization.',
      features: ['Unlimited Categories', 'Advanced Risk Alerts (Realtime)', 'Weekly Forecasts', '5 Users', 'Priority Support', 'Scenario Comparison', 'API Access'],
      cta: 'Start Free Trial',
      featured: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Full-featured platform with dedicated support and custom ML models.',
      features: ['Everything in Pro', 'Custom ML Training', 'Dedicated Account Manager', 'Unlimited Users', 'SLA Guarantee', 'SSO & Advanced Security', 'Custom Integrations'],
      cta: 'Contact Sales',
      featured: false
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-soft border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-200/50 flex items-center justify-center shadow-glow-primary group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="FinSight Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold text-slate-900">FinSight <span className="text-primary-600">Suite</span></span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="btn-ghost">Sign In</Link>
              <Link href="/dashboard" className="btn-primary">
                Launch App <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-medium animate-slide-down">
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="btn-outline w-full">Sign In</Link>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full">Launch App</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-primary-100/40 via-secondary-50/30 to-transparent rounded-full blur-3xl -mt-64" />
          <div className="absolute top-40 right-0 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute top-60 left-0 w-80 h-80 bg-secondary-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-semibold mb-8 animate-slide-down">
              <Sparkles className="w-4 h-4" />
              <span>Built with Next.js, FastAPI & XGBoost — Hackathon 2026</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.05] animate-slide-up">
              AI-Powered{' '}
              <span className="text-gradient-primary">Financial Intelligence</span>{' '}
              for Modern Teams
            </h1>

            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Optimize budgets with SLSQP constrained optimization, monitor risk across 5 dimensions in real-time, and forecast spend with XGBoost machine learning — all in one unified platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link href="/dashboard" className="btn-primary text-base px-8 py-4 w-full sm:w-auto group">
                Explore Live Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="#features" className="btn-outline text-base px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2 group">
                <Cpu className="w-5 h-5 text-primary-600 group-hover:scale-110 transition-transform" />
                Explore Features
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-slate-500 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span>Supabase-powered security</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-500" />
                <span>Open source core</span>
              </div>
            </div>
          </div>

          <div className="mt-20 max-w-6xl mx-auto animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative rounded-3xl border border-slate-200/80 shadow-xlarge overflow-hidden bg-gradient-to-b from-slate-50 to-white p-2">
              <div className="absolute -inset-x-40 -top-40 h-80 bg-gradient-to-r from-primary-500/10 via-secondary-500/10 to-accent-500/10 blur-3xl pointer-events-none" />
              <div className="relative bg-white rounded-[22px] border border-slate-200/60 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-500 font-mono">
                      <Globe className="w-3.5 h-3.5" />
                      app.finsight-suite.com/dashboard
                    </div>
                  </div>
                  <div className="w-14" />
                </div>
                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: 'Total Budget', value: '₹847K', trend: '+12.4%', color: 'primary' },
                      { label: 'Risk Score', value: '38.2', trend: 'Medium', color: 'warning' },
                      { label: 'Active Alerts', value: '3', trend: '2 critical', color: 'danger' },
                      { label: 'ML Status', value: 'Active', trend: 'v2.4.1', color: 'success' },
                    ].map((k, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-b from-white to-slate-50">
                        <p className="text-xs text-slate-500 font-medium mb-1.5">{k.label}</p>
                        <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                        <p className={`text-xs mt-1 font-semibold ${
                          k.color === 'primary' ? 'text-primary-600' :
                          k.color === 'warning' ? 'text-warning-600' :
                          k.color === 'danger' ? 'text-danger-600' : 'text-success-600'
                        }`}>{k.trend}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 p-5 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Spend vs Recommended</p>
                          <p className="text-xs text-slate-500">Last 6 months performance</p>
                        </div>
                        <LineChart className="w-5 h-5 text-primary-500" />
                      </div>
                      <MiniChart />
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-5 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Risk Posture</p>
                          <p className="text-xs text-slate-500">Composite gauge</p>
                        </div>
                        <ShieldAlert className="w-5 h-5 text-warning-500" />
                      </div>
                      <div className="flex justify-center py-4">
                        <div className="relative w-40 h-20">
                          <svg viewBox="0 0 200 100" className="w-full h-full">
                            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
                            <path d="M 20 90 A 80 80 0 0 1 100 20" fill="none" stroke="#f59e0b" strokeWidth="14" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                            <span className="text-2xl font-bold text-slate-900">38.2</span>
                            <span className="text-[10px] font-semibold text-warning-600 uppercase tracking-wider">Medium</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success-500" />Liquidity 34</div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning-500" />Market 72</div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning-500" />Credit 45</div>
                        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger-500" />Operational 60</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-50/50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl md:text-5xl font-extrabold text-gradient-primary mb-2">{stat.value}</div>
                <div className="text-sm font-medium text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-primary mb-4">
              <Cpu className="w-3.5 h-3.5" /> Core Capabilities
            </span>
            <h2 className="section-title md:text-4xl lg:text-5xl mb-5">
              Everything you need for{' '}
              <span className="text-gradient-primary">financial clarity</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Six powerful modules working together on a unified platform powered by cutting-edge ML and battle-tested optimization algorithms.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedFeature(f)}
                className="card p-7 card-hover group cursor-pointer flex flex-col justify-between border border-slate-100 hover:border-primary-200 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-14 h-14 rounded-2xl ${f.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <f.icon className={`w-7 h-7 ${f.iconColor}`} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${f.badgeColor}`}>
                      {f.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-primary-600 transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    {f.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFeature(f);
                    }}
                    className="inline-flex items-center text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors group/btn"
                  >
                    Learn more
                    <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                  <span className="text-xs text-slate-400 font-medium group-hover:text-slate-500">
                    Click for specs
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Feature Deep-Dive Modal */}
          {selectedFeature && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
              onClick={() => setSelectedFeature(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-scale-up relative"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-6 md:p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-primary-950 text-white relative">
                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center text-white shadow-glow-primary">
                      <selectedFeature.icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary-500/30 text-primary-300 border border-primary-400/30">
                        {selectedFeature.tag}
                      </span>
                      <h3 className="text-2xl font-extrabold text-white mt-1">
                        {selectedFeature.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed">
                    {selectedFeature.description}
                  </p>
                </div>

                {/* Metrics Badges */}
                {selectedFeature.metrics && (
                  <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/80">
                    {selectedFeature.metrics.map((m, i) => (
                      <div key={i} className="p-4 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{m.label}</p>
                        <p className="text-sm md:text-base font-extrabold text-slate-900 mt-0.5">{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Modal Body: How It Works */}
                <div className="p-6 md:p-8 space-y-6 max-h-[50vh] overflow-y-auto">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                      Key Capabilities & Architecture
                    </h4>
                    <ul className="space-y-2.5">
                      {selectedFeature.details.map((point, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="btn-outline text-xs md:text-sm"
                  >
                    Close
                  </button>
                  <Link
                    href={selectedFeature.href}
                    onClick={() => setSelectedFeature(null)}
                    className="btn-primary text-xs md:text-sm"
                  >
                    Launch {selectedFeature.shortTitle}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="py-24 lg:py-32 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-secondary mb-4">
              <Zap className="w-3.5 h-3.5" /> Simple Setup
            </span>
            <h2 className="section-title md:text-4xl lg:text-5xl mb-5">
              From raw data to <span className="text-gradient-primary">smart decisions</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Get started in minutes with our streamlined 4-step process that takes you from data integration to actionable intelligence.
            </p>
          </div>

          <div className="relative grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="hidden lg:block absolute top-20 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary-200 via-secondary-200 to-accent-200" />
            {steps.map((s, idx) => (
              <div key={idx} className="relative">
                <div className="card p-7 text-center h-full card-hover">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-500 flex items-center justify-center text-white text-xl font-black mb-5 shadow-glow-primary">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{s.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-warning mb-4">
              <Star className="w-3.5 h-3.5 fill-warning-500" /> Trusted by Teams
            </span>
            <h2 className="section-title md:text-4xl lg:text-5xl mb-5">
              Loved by finance leaders <span className="text-gradient-primary">everywhere</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div key={idx} className="card p-7 card-hover">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-warning-500 fill-warning-500" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 lg:py-32 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge-accent mb-4">
              <Award className="w-3.5 h-3.5" /> Simple Pricing
            </span>
            <h2 className="section-title md:text-4xl lg:text-5xl mb-5">
              Plans that scale with your <span className="text-gradient-primary">ambitions</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Whether you're a scrappy startup or a Fortune 500 enterprise, we have a plan that fits perfectly.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative card p-8 ${plan.featured
                    ? 'ring-2 ring-primary-500 shadow-xlarge scale-[1.02] md:-my-4'
                    : 'card-hover'
                  }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary-600 to-primary-500 text-white text-xs font-bold shadow-glow-primary">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-6 h-10">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
                <Link href="/login" className={`w-full mb-7 ${plan.featured ? 'btn-primary' : 'btn-outline'}`}>
                  {plan.cta}
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[32px] animated-gradient-bg p-10 md:p-16 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse-slow" />
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary-400/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
            </div>
            <div className="relative grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5 leading-tight">
                  Ready to transform your financial decision-making?
                </h2>
                <p className="text-lg text-white/80 leading-relaxed mb-8">
                  Join hundreds of finance teams already making smarter decisions with FinSight Suite. Launch the app and see it in action today.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/dashboard" className="btn bg-white text-primary-700 hover:bg-slate-100 text-base px-7 py-3.5 group shadow-large">
                    Launch Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="/login" className="btn border border-white/30 text-white hover:bg-white/10 text-base px-7 py-3.5">
                    <Lock className="w-4 h-4" /> Sign In Securely
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: LayoutDashboard, label: '7 Powerful Pages' },
                  { icon: Users, label: 'Multi-User Support' },
                  { icon: Brain, label: 'XGBoost ML Engine' },
                  { icon: Zap, label: 'Realtime Updates' },
                ].map((item, i) => (
                  <div key={i} className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-5 hover:bg-white/15 transition-colors">
                    <item.icon className="w-6 h-6 text-white mb-3" />
                    <p className="text-white font-semibold text-sm">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center">
                  <img src="/logo.png" alt="FinSight Logo" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-bold">FinSight <span className="text-primary-400">Suite</span></span>
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed mb-5 max-w-sm">
                The complete AI-powered financial intelligence platform. Budget optimization, risk monitoring, and ML forecasting built for the modern finance team.
              </p>
              <div className="flex gap-3">
                {['Twitter', 'LinkedIn', 'GitHub'].map((s) => (
                  <a key={s} href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-xs font-bold">
                    {s[0]}
                  </a>
                ))}
              </div>
            </div>
            {[
              { title: 'Product', links: ['Dashboard', 'Budget', 'Risk', 'ML Models', 'Settings'] },
              { title: 'Resources', links: ['Documentation', 'API Reference', 'Guides', 'Changelog', 'Support'] },
              { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact', 'Privacy'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>© 2026 FinSight Suite. Built with ❤️ for the hackathon competition.</p>
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success-500 glow-dot" />
              All systems operational
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


function MiniChart() {
  const data = [40, 32, 55, 48, 62, 70, 65, 82, 78, 90, 85, 95];
  const max = Math.max(...data);
  return (
    <div className="h-36 w-full flex items-end gap-1.5">
      {data.map((v, i) => {
        const h = (v / max) * 100;
        const isRec = i >= 7;
        return (
          <div key={i} className="flex-1 flex flex-col gap-1.5 items-center">
            <div className="w-full flex flex-col gap-1 justify-end flex-1">
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${
                  isRec
                    ? 'bg-gradient-to-t from-secondary-500 to-secondary-400'
                    : 'bg-gradient-to-t from-primary-600 to-primary-400'
                }`}
                style={{ height: `${h}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
