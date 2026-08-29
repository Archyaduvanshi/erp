import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  Megaphone,
  Pin,
  Search,
  Users,
  X,
} from 'lucide-react';
import { noticeApi } from '../../utils/api';
import { formatNoticeDate } from '../../utils/noticeUtils';
import { useAuth } from '../../context/AuthContext';

const PortalNotices = ({ role }) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [selectedNotice, setSelectedNotice] = useState(null);

  useEffect(() => {
    if (!session || session.role !== role) {
      navigate('/login');
    }
  }, [navigate, role, session]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const portalQuery = useInfiniteQuery({
    queryKey: ['notices', 'portal', role, { search: debouncedSearchTerm, priority: priorityFilter }],
    queryFn: ({ pageParam = 0 }) => noticeApi.getPortalAll({
      page: pageParam,
      size: 20,
      search: debouncedSearchTerm,
      priority: priorityFilter === 'All' ? '' : priorityFilter,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage?.last ? undefined : Number(lastPage?.number || 0) + 1),
    enabled: Boolean(session && session.role === role),
  });

  const portalOverviewQuery = useQuery({
    queryKey: ['notices', 'portal-overview', role, { search: debouncedSearchTerm, priority: priorityFilter }],
    queryFn: () => noticeApi.getPortalOverview({
      search: debouncedSearchTerm,
      priority: priorityFilter === 'All' ? '' : priorityFilter,
    }),
    enabled: Boolean(session && session.role === role),
  });

  const detailQuery = useQuery({
    queryKey: ['notices', 'portal-detail', selectedNotice?.id],
    queryFn: () => noticeApi.getPortalDetail(selectedNotice.id),
    enabled: Boolean(selectedNotice?.id),
  });

  const portalNotices = useMemo(() => (
    (portalQuery.data?.pages || []).flatMap((page) => Array.isArray(page?.content) ? page.content : [])
  ), [portalQuery.data]);
  const selectedNoticeDetail = detailQuery.data || selectedNotice;
  const totalNoticeCount = portalOverviewQuery.data?.total ?? portalQuery.data?.pages?.[0]?.totalElements ?? 0;
  const pinnedNoticeCount = portalOverviewQuery.data?.pinned ?? 0;
  const urgentNoticeCount = portalOverviewQuery.data?.urgent ?? 0;

  if (!session || session.role !== role) return null;

  const dashboardPath = role === 'teacher' ? '/teacher' : '/student';
  const portalTitle = role === 'teacher' ? 'Teacher Notices' : 'Student Notices';
  const headerClasses = role === 'teacher'
    ? {
      button: 'hover:border-emerald-300 hover:text-emerald-700',
      logo: 'bg-emerald-600',
      brand: 'text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-700',
    }
    : {
      button: 'hover:border-cyan-300 hover:text-cyan-700',
      logo: 'bg-cyan-600',
      brand: 'text-cyan-800',
      badge: 'bg-cyan-100 text-cyan-700',
    };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-5 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className={`flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition ${headerClasses.button}`}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div className={`rounded-lg ${headerClasses.logo} p-1.5 shadow-sm`}>
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className={`hidden font-black uppercase italic tracking-tighter ${headerClasses.brand} sm:block sm:text-xl`}>EduStream</span>
          </div>

          <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${headerClasses.badge}`}>
            Notice Board
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-6 pt-12 md:px-12 lg:px-20">
        {portalQuery.error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {portalQuery.error.message || 'Unable to load notices.'}
          </div>
        ) : null}
        {portalOverviewQuery.error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {portalOverviewQuery.error.message || 'Unable to load notice overview.'}
          </div>
        ) : null}
        <section className={`overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,#0f172a_0%,#4c1d95_55%,#0e7490_100%)] px-8 py-8 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)] md:px-12 md:py-10`}>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-violet-100">{portalTitle}</p>
              <h1 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Official notices sent by {session.instituteName || 'your college'}.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-violet-50/85">
                Published campus announcements, pinned updates, academic circulars, event alerts, and urgent notices appear here.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Visible Notices" value={totalNoticeCount} icon={Megaphone} />
              <MetricCard label="Pinned" value={pinnedNoticeCount} icon={Pin} />
              <MetricCard label="Urgent" value={urgentNoticeCount} icon={AlertTriangle} />
              <MetricCard label="Audience" value={role === 'teacher' ? 'Teachers' : 'Students'} icon={Users} />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Notice Register</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">{totalNoticeCount} notice(s) available for your portal.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="relative min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search notices..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              >
                {['All', 'Urgent', 'High', 'Normal', 'Low'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            {portalNotices.length ? (
              portalNotices.map((notice) => (
                <NoticeRow
                  key={notice.id}
                  notice={notice}
                  onClick={() => setSelectedNotice(notice)}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm font-semibold text-slate-500">
                No published notices are available right now.
              </div>
            )}
          </div>
          {portalQuery.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => portalQuery.fetchNextPage()}
                disabled={portalQuery.isFetchingNextPage}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {portalQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
              </button>
            </div>
          ) : null}
        </section>
      </main>
      <NoticeModal notice={selectedNoticeDetail} onClose={() => setSelectedNotice(null)} />
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-50/80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200/20 bg-violet-200/10 text-violet-50">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const NoticeRow = ({ notice, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="grid w-full gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50 md:grid-cols-[150px_1fr_130px] md:items-center"
  >
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getPriorityClass(notice.priority)}`}>
        {notice.priority}
      </span>
      {notice.isPinned ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">
          <Pin size={12} />
          Pinned
        </span>
      ) : null}
    </div>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
          {notice.category}
        </span>
        <span className="text-xs font-bold text-slate-400">{notice.audience}</span>
      </div>
      <h3 className="mt-2 truncate text-sm font-black text-slate-900 md:text-base">{notice.title}</h3>
      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{notice.summary}</p>
    </div>
    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 md:justify-end">
      <CalendarDays size={14} />
      {formatNoticeDate(notice.publishDate)}
    </div>
  </button>
);

const NoticeModal = ({ notice, onClose }) => {
  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getPriorityClass(notice.priority)}`}>
                {notice.priority}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                {notice.category}
              </span>
              {notice.isPinned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-700">
                  <Pin size={12} />
                  Pinned
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 font-serif text-2xl font-black italic tracking-tight text-slate-950">{notice.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950"
            aria-label="Close notice"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{notice.summary}</p>
        <p className="mt-5 whitespace-pre-line rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">{notice.details}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatNoticeDate(notice.publishDate)}</span>
          <span className="inline-flex items-center gap-1.5"><Users size={14} />{notice.audience}</span>
        </div>
      </div>
    </div>
  );
};

function getPriorityClass(priority) {
  if (priority === 'Urgent') return 'bg-rose-100 text-rose-700';
  if (priority === 'High') return 'bg-orange-100 text-orange-700';
  if (priority === 'Low') return 'bg-slate-200 text-slate-600';
  return 'bg-indigo-100 text-indigo-700';
}

export default PortalNotices;
