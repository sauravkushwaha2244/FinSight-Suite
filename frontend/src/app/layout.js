'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import { Menu, TrendingUp } from 'lucide-react';
import './globals.css';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isLandingPage = pathname === '/';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>FinSight Suite — AI-Powered Financial Intelligence Platform</title>
        <meta name="description" content="Advanced budget optimization, risk intelligence, and ML-powered forecasting for modern finance teams." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1e40af" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/logo.png" />
      </head>
      <body>
          {isLandingPage ? (
            <main className="min-h-screen">
              {children}
            </main>
          ) : isLoginPage ? (
            <main className="min-h-screen animated-gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
              </div>
              <div className="relative w-full max-w-5xl animate-fade-in">
                {children}
              </div>
            </main>
          ) : (
            <div className="min-h-screen bg-slate-50 relative flex flex-col lg:flex-row">
              <Sidebar
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
              />

              <div
                className={`flex-1 flex flex-col min-w-0 w-full content-smooth ${
                  sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[260px]'
                }`}
              >
                {/* Mobile Top Navigation Header */}
                <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-white/10 shadow-sm backdrop-blur">
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Open Navigation Menu"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center shadow-sm">
                      <img src="/logo.png" alt="FinSight Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold text-sm tracking-tight">FinSight Suite</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary-500/20 text-primary-300 rounded border border-primary-400/30">
                      LIVE
                    </span>
                  </div>
                  <div className="w-8" />
                </header>

                <main className="flex-1 w-full min-w-0">
                  <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1700px] w-full mx-auto animate-fade-in">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          )}
      </body>
    </html>
  );
}
