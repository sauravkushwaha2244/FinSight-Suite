'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import {
  TrendingUp, Shield, Brain, Wallet,
  CheckCircle2, ArrowRight, Sparkles, Globe, Lock,
  Mail, User, Eye, EyeOff, Loader2, AlertCircle, Key
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { session, login, register, signInWithGoogle } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          throw new Error('Please fill in all fields.');
        }
        await login(email.trim(), password);
      } else {
        if (!email.trim() || !password || !fullName.trim()) {
          throw new Error('Please fill in all fields.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await register(email.trim(), password, fullName.trim());
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setMode('login');
    setEmail('admin@finsight.com');
    setPassword('admin123');
    setError('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign-in is unavailable. Enable Google in Supabase Authentication providers.');
      setIsSubmitting(false);
    }
  };

  const features = [
    { icon: Wallet, text: 'Smart budget optimization with 3 scenarios' },
    { icon: Shield, text: 'Real-time risk monitoring across 5 dimensions' },
    { icon: Brain, text: 'XGBoost ML forecasting with walk-forward CV' },
    { icon: Lock, text: 'Enterprise JWT authentication & persistent SQLite DB' },
  ];

  if (!mounted) return null;

  return (
    <div className="w-full">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch min-h-[640px]">
        {/* Left Branding Showcase */}
        <div className="hidden lg:flex flex-col justify-center rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-primary-900 p-10 xl:p-14 relative overflow-hidden shadow-xlarge border border-white/10">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 right-10 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
            <div className="absolute bottom-10 left-10 w-72 h-72 bg-secondary-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-400 flex items-center justify-center shadow-glow-primary">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white leading-none">FinSight</h1>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-300">Suite Pro</p>
              </div>
            </div>

            <h2 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
              Financial intelligence
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-300 via-secondary-300 to-accent-300">
                reimagined
              </span>
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-10 max-w-md">
              The all-in-one platform for real-time budget optimization, multi-dimensional risk intelligence, and ML spend forecasting.
            </p>

            <div className="space-y-3.5 mb-10">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-300 flex-shrink-0">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-slate-100 text-sm">{f.text}</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold mb-0.5">Live Production-Ready Architecture</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Next.js 14 App Router • FastAPI Backend • SQLite Persistence • Scipy SLSQP • XGBoost
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="flex items-center justify-center py-6">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-glow-primary">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900">FinSight <span className="text-primary-600">Suite</span></h1>
              </div>
              <p className="text-slate-500">Financial Intelligence Platform</p>
            </div>

            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-3xl shadow-xlarge p-7 md:p-9 animate-scale-in">
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                  {mode === 'login' ? 'Sign in to FinSight' : 'Create your account'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {mode === 'login' 
                    ? 'Enter your credentials to access your financial dashboard' 
                    : 'Set up your administrator profile to get started'}
                </p>
              </div>

              {/* Mode Tabs */}
              <div className="flex p-1 mb-6 bg-slate-100/90 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(''); }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-sm animate-fade-in">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-70 disabled:pointer-events-none"
              >
                <span className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-xs font-black text-blue-600">G</span>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">or use email</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Alex Morgan"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={mode === 'register' ? 'Min 6 characters' : 'Enter your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{mode === 'login' ? 'Authenticating...' : 'Creating Account...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign In to Suite' : 'Create Account & Continue'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick-fill Helper for instant testing */}
              <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Key className="w-3.5 h-3.5 text-primary-600" />
                    <span>Quick Admin Login:</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillDemoAdmin}
                    className="text-xs font-bold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors border border-primary-200/60"
                  >
                    Auto-fill Credentials
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Email: <span className="font-mono text-slate-700">admin@finsight.com</span> • Password: <span className="font-mono text-slate-700">admin123</span>
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-center gap-5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>JWT Encrypted</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Real-Time Live Mode</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary-600 transition-colors"
              >
                ← Back to landing page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
