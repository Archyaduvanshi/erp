import React from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, GraduationCap, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const copyBySection = {
  reports: {
    title: 'Reports Studio',
    eyebrow: 'Analytics module',
    description: 'Institution reports, exports, and performance summaries are being shaped into a focused workspace.',
  },
  settings: {
    title: 'Platform Settings',
    eyebrow: 'Configuration module',
    description: 'Institute preferences, permissions, and system controls are being prepared for a clean admin experience.',
  },
  default: {
    title: 'Module In Development',
    eyebrow: 'Coming soon',
    description: 'This workspace is being prepared with focused workflows, useful actions, and a polished experience. It will be available in an upcoming update.',
  },
};

const ComingSoonPage = ({ title, description, backTo, backLabel = 'Back To Dashboard' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sectionKey = Object.keys(copyBySection).find((key) => location.pathname.toLowerCase().includes(key)) || 'default';
  const content = copyBySection[sectionKey];
  const moduleName = getModuleName(location.pathname);
  const resolvedTitle = title || (sectionKey === 'default' ? `${moduleName} In Development` : content.title);
  const resolvedDescription = description || content.description;
  const resolvedBackTo = backTo || getDashboardPath(location.pathname);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7ff_48%,#f8fafc_100%)] text-slate-950">
      <header className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <button
            type="button"
            onClick={() => navigate(resolvedBackTo)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
              <GraduationCap size={20} />
            </div>
            <span className="hidden text-sm font-black uppercase italic tracking-tight text-slate-900 sm:inline">VidyantraErp</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 shadow-sm">
            <Sparkles size={14} />
            {content.eyebrow}
          </div>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl font-black italic leading-none tracking-tight text-slate-950 md:text-7xl">
            {resolvedTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-600">
            {resolvedDescription}
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Development is active. This section is reserved for the next release.
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(resolvedBackTo)}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-sky-700"
            >
              Return To Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Switch Account
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)]">
          <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-200">Build status</p>
            <div className="mt-6 grid gap-4">
              <StatusRow icon={ClipboardList} title="Workflow Design" text="User flows and module structure are being finalized." />
              <StatusRow icon={CalendarClock} title="Interface Build" text="Screens, states, and actions are being prepared." />
              <StatusRow icon={CheckCircle2} title="Quality Review" text="The module will open after testing and verification." />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

const StatusRow = ({ icon: Icon, title, text }) => (
  <div className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-300/15 text-sky-100">
      <Icon size={18} />
    </div>
    <div>
      <h3 className="text-sm font-black tracking-tight text-white">{title}</h3>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{text}</p>
    </div>
  </div>
);

const getDashboardPath = (pathName) => {
  if (pathName.startsWith('/teacher')) return '/teacher';
  if (pathName.startsWith('/student')) return '/student';
  if (pathName.startsWith('/college')) return '/college';
  return '/';
};

const getModuleName = (pathName) => {
  const segment = pathName.split('/').filter(Boolean).at(-1);

  if (!segment) return 'Module';

  return segment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default ComingSoonPage;
