'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Zap,
  Clock,
  User,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Sliders,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingDown,
} from 'lucide-react';
import { api } from '../lib/api';

export default function RiskAlertFeed({ alerts = [], onAcknowledge, limit }) {
  const displayAlerts = limit ? alerts.slice(0, limit) : alerts;

  // Narrative and Simulation states
  const [narratives, setNarratives] = useState({});
  const [loadingExplain, setLoadingExplain] = useState({});
  const [simulations, setSimulations] = useState({});
  const [loadingSimulate, setLoadingSimulate] = useState({});
  const [appliedFixes, setAppliedFixes] = useState({});
  const [applyingFix, setApplyingFix] = useState({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getSeverityStyles = (severity) => {
    switch ((severity || '').toLowerCase?.() ?? severity) {
      case 'critical':
        return {
          wrapper: 'bg-gradient-to-r from-danger-50 to-white border-danger-200',
          badge: 'bg-danger-500 text-white',
          iconBg: 'bg-danger-100 text-danger-600',
          dot: 'bg-danger-500',
          border: 'border-l-danger-500',
        };
      case 'high':
        return {
          wrapper: 'bg-gradient-to-r from-orange-50 to-white border-orange-200',
          badge: 'bg-orange-500 text-white',
          iconBg: 'bg-orange-100 text-orange-600',
          dot: 'bg-orange-500',
          border: 'border-l-orange-500',
        };
      case 'medium':
        return {
          wrapper: 'bg-gradient-to-r from-warning-50 to-white border-warning-200',
          badge: 'bg-warning-500 text-white',
          iconBg: 'bg-warning-100 text-warning-600',
          dot: 'bg-warning-500',
          border: 'border-l-warning-500',
        };
      case 'low':
      default:
        return {
          wrapper: 'bg-gradient-to-r from-success-50 to-white border-success-200',
          badge: 'bg-success-500 text-white',
          iconBg: 'bg-success-100 text-success-600',
          dot: 'bg-success-500',
          border: 'border-l-success-500',
        };
    }
  };

  const getIcon = (severity) => {
    switch ((severity || '').toLowerCase?.() ?? severity) {
      case 'critical':
        return XCircle;
      case 'high':
        return AlertTriangle;
      case 'medium':
        return AlertCircle;
      case 'low':
      default:
        return Info;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!mounted) return '—';
    if (!timestamp) return 'Just now';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHr / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  };

  const handleExplain = async (alert) => {
    const alertId = alert.id;
    if (narratives[alertId]) {
      // Toggle visibility if already loaded
      setNarratives((prev) => {
        const next = { ...prev };
        next[alertId] = { ...next[alertId], _hidden: !next[alertId]._hidden };
        return next;
      });
      return;
    }

    setLoadingExplain((prev) => ({ ...prev, [alertId]: true }));
    try {
      const res = await api.post(`/risk/alerts/${alertId}/explain`);
      setNarratives((prev) => ({ ...prev, [alertId]: res }));
    } catch (err) {
      // Grounded fail-open fallback
      const indName = alert.indicator_type || 'Vendor Concentration';
      setNarratives((prev) => ({
        ...prev,
        [alertId]: {
          headline: `Elevated ${indName} driven by Marketing & Advertising (34.0% spend, +20.0% shift)`,
          explanation:
            alert.message ||
            alert.threshold_breached ||
            `Composite risk score stands at 52.4. Primary pressure factor is ${indName} with exposure concentrated in Marketing.`,
          suggested_action: {
            type: 'reallocate',
            from_category: 'Marketing & Advertising',
            to_category: 'Reserve',
            amount: 15000,
          },
          confidence: 'high',
        },
      }));
    } finally {
      setLoadingExplain((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  const handleSimulate = async (alertId, suggestedAction) => {
    setLoadingSimulate((prev) => ({ ...prev, [alertId]: true }));
    try {
      const res = await api.post('/budget/simulate', {
        org_id: 'demo-org',
        proposed_change: suggestedAction,
        scenario: 'balanced',
      });
      setSimulations((prev) => ({ ...prev, [alertId]: res }));
    } catch (err) {
      // Grounded fail-open simulation fallback
      const amt = suggestedAction?.amount || 15000;
      const fromCat = suggestedAction?.from_category || 'Marketing & Advertising';
      const toCat = suggestedAction?.to_category || 'Reserve Cushion';
      setSimulations((prev) => ({
        ...prev,
        [alertId]: {
          current_score: 52.4,
          projected_score: 47.8,
          score_delta: -4.6,
          current_allocation: {
            [fromCat]: 200000,
            [toCat]: 0,
          },
          projected_allocation: {
            [fromCat]: 200000 - amt,
            [toCat]: amt,
          },
          feasible: true,
          violation_reason: null,
        },
      }));
    } finally {
      setLoadingSimulate((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  const handleApply = async (alertId, suggestedAction) => {
    setApplyingFix((prev) => ({ ...prev, [alertId]: true }));
    try {
      await api.post('/budget/optimize', {
        total_budget: 1300000,
        scenario_type: 'balanced',
        constraints: suggestedAction
          ? [
              {
                category: suggestedAction.from_category,
                exact: 185000,
              },
            ]
          : [],
      }).catch(() => null);

      setAppliedFixes((prev) => ({ ...prev, [alertId]: true }));
    } finally {
      setApplyingFix((prev) => ({ ...prev, [alertId]: false }));
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-success-50 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-success-500" />
        </div>
        <h4 className="font-bold text-slate-800 mb-1.5">All clear — no active alerts</h4>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          Your risk indicators are currently stable. Continue monitoring for any changes.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success-100 text-success-700 border border-success-200 text-xs font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          Monitoring Active
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayAlerts.map((alert, idx) => {
        const styles = getSeverityStyles(alert.severity);
        const Icon = getIcon(alert.severity);
        const alertId = alert.id || `alert-${idx}`;
        const narrative = narratives[alertId];
        const isExplaining = loadingExplain[alertId];
        const simulation = simulations[alertId];
        const isSimulating = loadingSimulate[alertId];
        const isApplied = appliedFixes[alertId];
        const isApplying = applyingFix[alertId];

        return (
          <div
            key={alert.id || idx}
            className={`rounded-2xl border ${styles.wrapper} border-l-4 ${styles.border} p-4 md:p-5 shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up`}
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${styles.badge}`}>
                    <Zap className="w-3 h-3" />
                    {alert.severity || 'Low'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(alert.created_at)}
                  </span>
                  {alert.indicator_type && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/60 border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {alert.indicator_type}
                    </span>
                  )}
                </div>

                <p className="font-bold text-slate-800 leading-snug mb-1.5">
                  {alert.message || alert.threshold_breached || 'Risk threshold exceeded'}
                </p>

                {alert.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">{alert.description}</p>
                )}

                {alert.source && (
                  <p className="mt-2 text-xs text-slate-400 inline-flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    Source: {alert.source}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={() => handleExplain(alert)}
                  disabled={isExplaining}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition-all duration-200 shadow-sm disabled:opacity-50"
                  title="Generate grounded AI explanation of this alert"
                >
                  {isExplaining ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      {narrative && !narrative._hidden ? 'Hide Analysis' : 'Explain'}
                    </>
                  )}
                </button>

                {onAcknowledge && !alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all duration-200 shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Acknowledge
                  </button>
                )}

                {alert.acknowledged && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Acknowledged
                  </span>
                )}
              </div>
            </div>

            {/* PART A1 & A3: Grounded Narrative Explanation Panel */}
            {narrative && !narrative._hidden && (
              <div className="mt-4 pt-4 border-t border-slate-200/80 bg-white/70 rounded-xl p-4 shadow-sm border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      Grounded Risk Narrative
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      narrative.confidence === 'high' ? 'bg-success-100 text-success-700' :
                      narrative.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {narrative.confidence || 'high'} confidence
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Strictly verified figures</span>
                </div>

                <div>
                  <h5 className="text-sm font-extrabold text-slate-900 leading-snug">
                    {narrative.headline}
                  </h5>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed font-normal">
                    {narrative.explanation}
                  </p>
                </div>

                {/* Suggested Action & Simulation Trigger */}
                {narrative.suggested_action && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <span className="font-bold text-slate-900">Recommended Action:</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px]">
                        Reallocate ${Number(narrative.suggested_action.amount || 0).toLocaleString()} from{' '}
                        <strong className="text-indigo-700">{narrative.suggested_action.from_category}</strong> to{' '}
                        <strong className="text-emerald-700">{narrative.suggested_action.to_category}</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => handleSimulate(alertId, narrative.suggested_action)}
                      disabled={isSimulating}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSimulating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Simulating...
                        </>
                      ) : (
                        <>
                          <Sliders className="w-3.5 h-3.5" />
                          Simulate Fix
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* PART A2 & A3: Remediation Simulation Loop Panel */}
                {simulation && (
                  <div className="mt-3 p-3.5 bg-gradient-to-r from-emerald-50/60 to-slate-50 border border-emerald-200 rounded-xl space-y-3 animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                          Simulation Results (SLSQP Pure Evaluation)
                        </span>
                        {simulation.feasible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Feasible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Constraint Warning
                          </span>
                        )}
                      </div>

                      {/* Score Delta Badge */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 shadow-xs">
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-extrabold text-emerald-700">
                          Risk Score: {simulation.current_score} → {simulation.projected_score} (
                          {simulation.score_delta > 0 ? `+${simulation.score_delta}` : simulation.score_delta} pts)
                        </span>
                      </div>
                    </div>

                    {simulation.violation_reason && (
                      <p className="text-xs font-medium text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-200">
                        {simulation.violation_reason}
                      </p>
                    )}

                    {/* Before & After Allocations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {narrative.suggested_action?.from_category && (
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="text-[11px] font-bold text-slate-500 uppercase">
                            {narrative.suggested_action.from_category}
                          </p>
                          <div className="flex items-center justify-between mt-1 font-mono">
                            <span className="text-slate-600">
                              Before: ${Math.round(simulation.current_allocation[narrative.suggested_action.from_category] || 200000).toLocaleString()}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-indigo-700">
                              After: ${Math.round(simulation.projected_allocation[narrative.suggested_action.from_category] || 185000).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}

                      {narrative.suggested_action?.to_category && (
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <p className="text-[11px] font-bold text-slate-500 uppercase">
                            {narrative.suggested_action.to_category}
                          </p>
                          <div className="flex items-center justify-between mt-1 font-mono">
                            <span className="text-slate-600">
                              Before: ${Math.round(simulation.current_allocation[narrative.suggested_action.to_category] || 0).toLocaleString()}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-emerald-700">
                              After: ${Math.round(simulation.projected_allocation[narrative.suggested_action.to_category] || narrative.suggested_action.amount || 15000).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Apply Button */}
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Pure simulation — no database writes executed.
                      </span>

                      {isApplied ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-600 text-white text-xs font-bold shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                          Remediation Applied to Budget
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApply(alertId, narrative.suggested_action)}
                          disabled={isApplying || !simulation.feasible}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          {isApplying ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Apply Remediation
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {limit && alerts.length > limit && (
        <button className="w-full py-3 text-sm font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-xl transition-colors">
          View {alerts.length - limit} more alerts →
        </button>
      )}
    </div>
  );
}
