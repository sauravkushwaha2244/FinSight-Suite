'use client';

import { useState } from 'react';
import { WifiOff, RefreshCw, Server, AlertTriangle, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

export default function BackendError({
  title = 'Backend unavailable',
  message = 'Unable to connect to the FinSight API server. Real financial intelligence metrics and predictions cannot be loaded.',
  error = null,
  onRetry = null,
  loading = false,
  fullPage = true,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const content = (
    <div className="max-w-xl w-full mx-auto text-center">
      {/* Icon with glowing backdrop */}
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="absolute -inset-2 bg-gradient-to-r from-danger-500/20 to-orange-500/20 rounded-full blur-xl animate-pulse" />
        <div className="relative w-20 h-20 rounded-3xl bg-danger-50 border border-danger-200 flex items-center justify-center shadow-lg">
          <WifiOff className="w-10 h-10 text-danger-600" />
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-danger-100 text-danger-800 border border-danger-200">
          <span className="w-2 h-2 rounded-full bg-danger-500 animate-ping" />
          API Offline
        </span>
      </div>

      {/* Main Title & Message */}
      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
        {title}
      </h2>
      <p className="text-slate-600 leading-relaxed text-sm md:text-base max-w-md mx-auto mb-6">
        {message}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-md hover:shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Connecting...' : 'Retry Connection'}
          </button>
        )}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="btn-outline flex items-center gap-1.5 text-xs text-slate-600"
        >
          <Server className="w-3.5 h-3.5 text-slate-500" />
          Technical Info
          {showDetails ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
        </button>
      </div>

      {/* Collapsible Details */}
      {showDetails && (
        <div className="text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-xs text-slate-600 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-semibold text-slate-700">
            <span>Target Endpoint:</span>
            <code className="text-primary-700 bg-primary-50 px-2 py-0.5 rounded font-mono text-[11px]">{apiUrl}</code>
          </div>
          {error && (
            <div>
              <p className="font-semibold text-slate-700 mb-1">Error Message:</p>
              <pre className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-danger-700 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                {typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error)}
              </pre>
            </div>
          )}
          <div className="pt-2 text-slate-500 text-[11px] flex items-start gap-2">
            <Terminal className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>To start the backend, execute: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">uvicorn main:app --reload --port 8000</code> in the backend directory.</span>
          </div>
        </div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="card p-8 md:p-14 flex items-center justify-center min-h-[460px] bg-gradient-to-b from-white to-slate-50/50">
        {content}
      </div>
    );
  }

  return (
    <div className="card p-6 border-danger-200 bg-danger-50/30">
      {content}
    </div>
  );
}
