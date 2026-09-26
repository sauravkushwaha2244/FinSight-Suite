'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import {
  LayoutDashboard, Wallet, ShieldAlert, Target, Tags, Brain,
  LogOut, TrendingUp, ChevronRight, User, Bell, X
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Sidebar({
  collapsed: externalCollapsed,
  setCollapsed: externalSetCollapsed,
  mobileOpen = false,
  setMobileOpen
}) {
  const pathname = usePathname();
  const { signOut, session } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isControlled = externalCollapsed !== undefined && externalSetCollapsed !== undefined;
  const collapsed = isControlled ? externalCollapsed : internalCollapsed;
  const setCollapsed = isControlled ? externalSetCollapsed : setInternalCollapsed;

  // Trigger resize event after transition so charts (Recharts) automatically re-fit
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 290);
    return () => clearTimeout(timer);
  }, [collapsed]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCollapsed]);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Main' },
    { name: 'Budget', href: '/budget', icon: Wallet, group: 'Main' },
    { name: 'Risk', href: '/risk', icon: ShieldAlert, group: 'Main' },
    { name: 'Priorities', href: '/settings/priorities', icon: Target, group: 'Settings' },
    { name: 'Categories', href: '/settings/categories', icon: Tags, group: 'Settings' },
    { name: 'ML Models', href: '/admin/models', icon: Brain, group: 'Admin' },
  ];

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const userEmail = session?.user?.email || 'admin@finsight.com';
  const userInitials = userEmail.split('@')[0].slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen && setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen z-40 sidebar-smooth select-none ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'
        } ${
          mobileOpen
            ? 'translate-x-0 w-[260px] shadow-2xl'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Floating Desktop Toggle Pill on the sidebar border */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-5 z-50 w-6 h-6 rounded-full bg-slate-800 hover:bg-primary-600 text-slate-300 hover:text-white border border-slate-600 shadow-md items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500"
          title={collapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`} />
        </button>

        <div className="h-full bg-gradient-dark flex flex-col shadow-xlarge border-r border-white/5 relative overflow-hidden">
          {/* Top Header */}
          <div className="h-16 px-4 border-b border-white/5 flex items-center justify-between relative flex-shrink-0">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen && setMobileOpen(false)}
              className="flex items-center gap-3 group flex-shrink-0"
              title="FinSight Suite"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center shadow-glow-primary group-hover:scale-105 transition-transform flex-shrink-0">
                <img src="/logo.png" alt="FinSight Suite Logo" className="w-full h-full object-cover" />
              </div>
              <div
                className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-200 ${
                  collapsed && !mobileOpen
                    ? 'max-w-0 opacity-0 pointer-events-none'
                    : 'max-w-[160px] opacity-100'
                }`}
              >
                <span className="text-lg font-bold text-white leading-none">FinSight</span>
                <span className="text-[10px] font-semibold text-primary-400 tracking-widest mt-0.5">SUITE</span>
              </div>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen && setMobileOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop Internal Collapse Button (visible when expanded) */}
            <button
              onClick={() => setCollapsed(true)}
              className={`hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 flex-shrink-0 ${
                collapsed && !mobileOpen ? 'opacity-0 pointer-events-none w-0 overflow-hidden' : 'opacity-100'
              }`}
              title="Collapse Sidebar"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="space-y-1">
                {(!collapsed || mobileOpen) ? (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {group}
                  </p>
                ) : (
                  <div className="my-2 border-t border-white/5 mx-2" />
                )}
                {items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen && setMobileOpen(false)}
                      className={`group relative flex items-center h-11 rounded-xl transition-all duration-150 ${
                        collapsed && !mobileOpen
                          ? 'justify-center px-0'
                          : 'px-3.5 gap-3'
                      } ${
                        isActive
                          ? 'bg-white/10 text-white shadow-inner-soft ring-1 ring-white/10'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                      title={collapsed && !mobileOpen ? item.name : ''}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-primary-400 to-secondary-400" />
                      )}
                      <div className={`${isActive ? 'text-primary-400' : 'text-slate-400 group-hover:text-white'} transition-colors flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {(!collapsed || mobileOpen) && (
                        <>
                          <span className="font-medium text-sm flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.name}
                          </span>
                          {isActive && item.name === 'Dashboard' && (
                            <span className="badge bg-primary-500/20 text-primary-300 border-0 text-[10px]">Live</span>
                          )}
                          {item.name === 'Risk' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-danger-500" />
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && !mobileOpen && item.name === 'Risk' && (
                        <span className="absolute top-2 right-2 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-danger-500" />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom Profile & Sign Out */}
          <div className="p-3 border-t border-white/5 flex-shrink-0">
            {collapsed && !mobileOpen ? (
              <div className="flex flex-col items-center gap-3 py-1">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/10 shadow-sm cursor-default"
                  title={`${userEmail} (Online)`}
                >
                  {userInitials || 'U'}
                </div>
                <button
                  onClick={signOut}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {userInitials || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{session?.user?.email?.split('@')[0] || 'User'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
                    </div>
                    <button className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0" title="Notifications">
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success-500/15 text-success-400 border border-success-500/20 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
                      Online
                    </span>
                    <span className="text-slate-400">Pro Plan</span>
                  </div>
                </div>

                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
