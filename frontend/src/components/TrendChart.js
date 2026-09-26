'use client';

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart } from 'recharts';

export default function TrendChart({
  data = [],
  xKey,
  yKeys = [],
  colors = [],
  title,
  subtitle,
  type = 'line',
  height = 320,
  showLegend = true,
  showGrid = true,
  action,
  gradientFill = true,
}) {
  const defaultColors = [
    ['#2563eb', '#60a5fa'],
    ['#0d9488', '#2dd4bf'],
    ['#dc2626', '#f87171'],
    ['#d97706', '#fbbf24'],
    ['#c026d3', '#e879f9'],
    ['#0ea5e9', '#7dd3fc'],
  ];
  const chartColors = colors.length > 0 ? colors : defaultColors.map(([primary]) => primary);
  const gradientPairs = colors.length > 0
    ? colors.map(c => [c, c])
    : defaultColors;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xlarge p-4 min-w-[200px]">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
          <div className="space-y-2">
            {payload.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {entry.name.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {typeof entry.value === 'number'
                    ? entry.value.toLocaleString('en-IN')
                    : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card p-6 lg:p-8">
      {(title || action) && (
        <div className="flex items-start justify-between mb-6">
          <div>
            {title && (
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {yKeys.map((key, index) => {
                  const [start, end] = gradientPairs[index % gradientPairs.length];
                  return (
                    <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={start} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={end} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />}
              <XAxis
                dataKey={xKey}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickMargin={10}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && (
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-sm font-medium text-slate-600 capitalize">
                      {value.replace(/_/g, ' ')}
                    </span>
                  )}
                />
              )}
              {yKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2.5}
                  fill={gradientFill ? `url(#color-${key})` : 'transparent'}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              ))}
            </AreaChart>
          ) : type === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {yKeys.map((key, index) => {
                  const [start, end] = gradientPairs[index % gradientPairs.length];
                  return (
                    <linearGradient key={key} id={`bar-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={start} />
                      <stop offset="100%" stopColor={end} />
                    </linearGradient>
                  );
                })}
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />}
              <XAxis
                dataKey={xKey}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickMargin={10}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.6 }} />
              {showLegend && (
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-sm font-medium text-slate-600 capitalize">
                      {value.replace(/_/g, ' ')}
                    </span>
                  )}
                />
              )}
              {yKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={`url(#bar-${key})`}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          ) : type === 'composed' ? (
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {yKeys.map((key, index) => {
                  const [start, end] = gradientPairs[index % gradientPairs.length];
                  return (
                    <linearGradient key={key} id={`comp-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={start} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={end} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />}
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} width={50} />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && (
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-sm font-medium text-slate-600 capitalize">
                      {value.replace(/_/g, ' ')}
                    </span>
                  )}
                />
              )}
              {yKeys.map((key, index) => {
                const isBar = index === 0;
                return isBar ? (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={`url(#comp-${key})`}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                  />
                ) : (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={chartColors[index % chartColors.length]}
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                );
              })}
            </ComposedChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {yKeys.map((key, index) => {
                  const [start, end] = gradientPairs[index % gradientPairs.length];
                  return (
                    <linearGradient key={key} id={`line-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={start} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={end} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />}
              <XAxis
                dataKey={xKey}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickMargin={10}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && (
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-sm font-medium text-slate-600 capitalize">
                      {value.replace(/_/g, ' ')}
                    </span>
                  )}
                />
              )}
              {yKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2.5}
                  fill={gradientFill ? `url(#line-${key})` : 'transparent'}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: chartColors[index % chartColors.length] }}
                  activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
