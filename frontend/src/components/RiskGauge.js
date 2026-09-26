'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function RiskGauge({ score = 0, severity = 'low', size = 'large' }) {
  const numScore = Math.max(0, Math.min(100, Number(score) || 0));
  
  const sizeConfig = {
    small: { width: 180, height: 110, inner: 55, outer: 75, text: 'text-2xl', sub: 'text-[10px]' },
    medium: { width: 240, height: 145, inner: 75, outer: 100, text: 'text-3xl', sub: 'text-xs' },
    large: { width: 300, height: 180, inner: 95, outer: 125, text: 'text-4xl', sub: 'text-sm' },
  };
  const cfg = sizeConfig[size] || sizeConfig.large;

  const data = [
    { name: 'score', value: numScore },
    { name: 'remainder', value: 100 - numScore }
  ];

  const getColor = (sev, sc) => {
    const s = sev?.toLowerCase?.() ?? '';
    if (s === 'critical' || sc >= 75) {
      return { main: '#dc2626', from: '#ef4444', to: '#b91c1c', bg: 'from-danger-500/10 to-danger-600/5', ring: 'ring-danger-500/20', badge: 'bg-danger-100 text-danger-800 border-danger-200' };
    }
    if (s === 'high' || sc >= 60) {
      return { main: '#ea580c', from: '#f97316', to: '#c2410c', bg: 'from-orange-500/10 to-orange-600/5', ring: 'ring-orange-500/20', badge: 'bg-orange-100 text-orange-800 border-orange-200' };
    }
    if (s === 'medium' || sc >= 35) {
      return { main: '#d97706', from: '#f59e0b', to: '#b45309', bg: 'from-amber-500/10 to-amber-600/5', ring: 'ring-amber-500/20', badge: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    return { main: '#059669', from: '#10b981', to: '#047857', bg: 'from-emerald-500/10 to-emerald-600/5', ring: 'ring-emerald-500/20', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  };

  const color = getColor(severity, numScore);
  const severityLabel = numScore >= 75 ? 'Critical' : numScore >= 60 ? 'High' : numScore >= 35 ? 'Medium' : 'Safe';

  return (
    <div className={`relative inline-flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-gradient-to-br ${color.bg} ring-1 ${color.ring} w-full max-w-sm mx-auto shadow-sm`}>
      <div style={{ width: cfg.width, height: cfg.height, position: 'relative' }} className="flex justify-center items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`gauge-bg-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
              <linearGradient id={`gauge-score-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color.from} />
                <stop offset="100%" stopColor={color.to} />
              </linearGradient>
            </defs>
            <Pie
              data={[{ name: 'bg', value: 100 }]}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius={cfg.inner}
              outerRadius={cfg.outer}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={`url(#gauge-bg-${size})`} />
            </Pie>
            <Pie
              data={data}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius={cfg.inner}
              outerRadius={cfg.outer}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell key="score" fill={`url(#gauge-score-${size})`} />
              <Cell key="remainder" fill="transparent" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Score & Badge */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-3 pointer-events-none">
          <span className={`font-black text-slate-900 tracking-tight leading-none ${cfg.text}`}>
            {numScore.toFixed(1)}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 mt-1.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${color.badge}`}>
            {severityLabel} Risk
          </span>
        </div>
      </div>

      {/* Legend & Scale Footer */}
      <div className="w-full flex items-center justify-between mt-5 pt-3 border-t border-slate-200/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        <span>0</span>
        <span className="text-emerald-600">Safe</span>
        <span className="text-amber-600">Medium</span>
        <span className="text-danger-600">Danger</span>
        <span>100</span>
      </div>
    </div>
  );
}
