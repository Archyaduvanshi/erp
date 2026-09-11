import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, FileClock, GraduationCap, LayoutDashboard,
  LogOut, Menu, Receipt, Settings, ShieldCheck, WalletCards, X } from 'lucide-react';
import { usePlatformAuth } from '../../context/PlatformAuthContext';

const links = [
  ['/platform/dashboard', LayoutDashboard, 'Dashboard'],
  ['/platform/institutes', Building2, 'Institutes'],
  ['/platform/subscriptions', CreditCard, 'Subscriptions'],
  ['/platform/features', ShieldCheck, 'Feature Access'],
  ['/platform/billing', Receipt, 'Billing'],
  ['/platform/gateways', WalletCards, 'Payment Gateways'],
  ['/platform/usage', BarChart3, 'Platform Usage'],
  ['/platform/audit', FileClock, 'Audit Logs'],
  ['/platform/settings', Settings, 'Settings'],
];

const PlatformLayout = ({ children, title, subtitle }) => {
  const { session, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const signOut = () => logout().finally(() => navigate('/platform/login'));
  const nav = <nav className="space-y-1 px-3 py-5">{links.map(([to, Icon, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex h-11 items-center gap-3 rounded-lg px-3 text-xs font-black uppercase transition ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>;

  return <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white"><div className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 md:px-6"><div className="flex min-w-0 items-center gap-4"><button type="button" title="Open navigation" onClick={() => setOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"><Menu size={20} /></button><button type="button" onClick={() => navigate('/platform/dashboard')} className="flex shrink-0 items-center gap-3"><span className="rounded-lg bg-emerald-600 p-2 text-white"><GraduationCap size={20} /></span><span className="hidden text-lg font-black uppercase italic text-emerald-800 sm:block">VidyantraErp</span></button><div className="min-w-0 border-l border-slate-100 pl-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Platform Console</p><h1 className="truncate font-serif text-xl font-black italic text-slate-950 md:text-2xl">{title}</h1>{subtitle && <p className="mt-1 hidden text-xs text-slate-500 xl:block">{subtitle}</p>}</div></div><div className="flex shrink-0 items-center gap-3"><div className="hidden text-right md:block"><p className="text-xs font-black text-slate-700">{session?.displayName}</p><span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Super Admin</span></div><button type="button" onClick={signOut} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-rose-100"><LogOut size={16} /><span className="hidden sm:inline">Logout</span></button></div></div></header>
    <div className="flex"><aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-60 shrink-0 overflow-y-auto border-r border-slate-100 bg-white lg:block">{nav}</aside><main className="min-w-0 flex-1 px-5 py-8 md:px-8">{children}</main></div>
    {open && <div className="fixed inset-0 z-50 bg-slate-950/30 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex h-20 items-center justify-between border-b px-5"><strong className="text-emerald-800">Platform Menu</strong><button type="button" title="Close navigation" onClick={() => setOpen(false)} className="p-2"><X size={20} /></button></div>{nav}</aside></div>}
  </div>;
};

export default PlatformLayout;
