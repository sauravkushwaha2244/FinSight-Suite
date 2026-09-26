'use client';

import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown } from 'lucide-react';

export default function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection,
  variant = 'default',
  loading = false,
}) {
  const variants = {
    default: {
      iconBg: 'bg-primary-50',
      iconColor: 'text-primary-600',
      accent: 'from-primary-600 to-primary-500',
      ring: 'ring-primary-50',
    },
    success: {
      iconBg: 'bg-success-50',
      iconColor: 'text-success-600',
      accent: 'from-success-600 to-success-500',
      ring: 'ring-success-50',
    },
    danger: {
      iconBg: 'bg-danger-50',
      iconColor: 'text-danger-600',
      accent: 'from-danger-600 to-danger-500',
      ring: 'ring-danger-50',
    },
    warning: {
      iconBg: 'bg-warning-50',
      iconColor: 'text-warning-600',
      accent: 'from-warning-600 to-warning-500',
      ring: 'ring-warning-50',
    },
    secondary: {
      iconBg: 'bg-secondary-50',
      iconColor: 'text-secondary-600',
      accent: 'from-secondary-600 to-secondary-500',
      ring: 'ring-secondary-50',
    },
    accent: {
      iconBg: 'bg-accent-50',
      iconColor: 'text-accent-600',
      accent: 'from-accent-600 to-accent-500',
      ring: 'ring-accent-50',
    },
  };

  const styles = variants[variant] || variants.default;

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-8 bg-slate-200 rounded w-32" />
            <div className="h-3 bg-slate-200 rounded w-20 mt-2" />
          </div>
          <div className={`w-12 h-12 rounded-xl ${styles.iconBg}`} />
        </div>
      </div>
    );
  }

  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColor =
    trendDirection === 'up' ? 'text-success-600 bg-success-50 border-success-100' :
    trendDirection === 'down' ? 'text-danger-600 bg-danger-50 border-danger-100' :
    'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div className={`card p-6 card-hover relative overflow-hidden group`}>
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${styles.accent} opacity-5 group-hover:opacity-10 transition-opacity duration-500`} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{title}</p>
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3 break-words">
            {value}
          </h3>
        </div>

        {Icon && (
          <div className={`w-12 h-12 rounded-xl ${styles.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
        )}
      </div>

      <div className="relative mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        {trend && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {trend}
          </span>
        )}
        {subtitle && (
          <span className="text-sm font-medium text-slate-500">{subtitle}</span>
        )}
        {!trend && !subtitle && <div />}
      </div>
    </div>
  );
}
