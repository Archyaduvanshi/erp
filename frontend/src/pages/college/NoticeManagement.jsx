import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { curriculumApi, noticeApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const today = new Date().toISOString().split('T')[0];
const isCollegeModuleSession = (session) => session?.role === 'admin' || session?.role === 'feature';

const initialNoticeForm = {
  title: '',
  category: 'General',
  audience: 'All',
  priority: 'Normal',
  publishDate: today,
  status: 'Draft',
  targetClassIds: [],
  summary: '',
  details: '',
};

const NoticeManagement = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const collegeId = session?.id || '';
  const [noticeForm, setNoticeForm] = useState(initialNoticeForm);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isCollegeModuleSession(session) || !collegeId) {
      navigate('/login');
      return;
    }
  }, [collegeId, navigate, session]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, statusFilter, audienceFilter, priorityFilter]);

  const overviewQuery = useQuery({
    queryKey: ['notices', 'overview'],
    queryFn: noticeApi.getOverview,
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
  });

  const noticesQuery = useQuery({
    queryKey: ['notices', 'admin', {
      page,
      size: 25,
      search: debouncedSearchTerm,
      status: statusFilter,
      audience: audienceFilter,
      priority: priorityFilter,
    }],
    queryFn: () => noticeApi.getAll({
      page,
      size: 25,
      search: debouncedSearchTerm,
      status: statusFilter === 'All' ? '' : statusFilter,
      audience: audienceFilter === 'All' ? '' : audienceFilter,
      priority: priorityFilter === 'All' ? '' : priorityFilter,
    }),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
    placeholderData: keepPreviousData,
  });

  const classOptionsQuery = useQuery({
    queryKey: ['curriculum', 'classes', 'notice-targets'],
    queryFn: () => curriculumApi.getClassSummaries(),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
  });

  const filteredNotices = Array.isArray(noticesQuery.data?.content) ? noticesQuery.data.content : [];
  const classOptions = Array.isArray(classOptionsQuery.data) ? classOptionsQuery.data : [];
  const stats = overviewQuery.data || { total: 0, published: 0, scheduled: 0, urgent: 0 };

  const invalidateNoticeQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['notices', 'admin'] });
    queryClient.invalidateQueries({ queryKey: ['notices', 'overview'] });
    queryClient.invalidateQueries({ queryKey: ['notices', 'portal'] });
  };

  const saveNoticeMutation = useMutation({
    mutationFn: ({ id, payload }) => (id ? noticeApi.update(id, payload) : noticeApi.create(payload)),
    onSuccess: () => {
      setNoticeForm(initialNoticeForm);
      setEditingId(null);
      setLoadError('');
      invalidateNoticeQueries();
    },
    onError: (error) => setLoadError(error.message || 'Unable to save notice.'),
  });

  const updateNoticeMutation = useMutation({
    mutationFn: ({ id, payload }) => noticeApi.update(id, payload),
    onSuccess: () => {
      setLoadError('');
      invalidateNoticeQueries();
    },
    onError: (error) => setLoadError(error.message || 'Unable to update notice.'),
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: noticeApi.delete,
    onSuccess: () => {
      setLoadError('');
      invalidateNoticeQueries();
    },
    onError: (error) => setLoadError(error.message || 'Unable to delete notice.'),
  });

  const handleSaveNotice = async (e) => {
    e.preventDefault();

    const payload = {
      ...noticeForm,
      title: noticeForm.title.trim(),
      expireDate: null,
      isPinned: false,
      targetClassIds: noticeForm.audience === 'Students' ? noticeForm.targetClassIds : [],
      summary: noticeForm.summary.trim(),
      details: noticeForm.details.trim(),
    };

    if (!payload.title || !payload.publishDate || !payload.summary || !payload.details) return;

    saveNoticeMutation.mutate({ id: editingId, payload });
  };

  const handleEditNotice = async (notice) => {
    const fullNotice = notice.details ? notice : await noticeApi.getById(notice.id);
    setEditingId(fullNotice.id);
    setNoticeForm({
      title: fullNotice.title || '',
      category: fullNotice.category || 'General',
      audience: fullNotice.audience || 'All',
      priority: fullNotice.priority || 'Normal',
      publishDate: fullNotice.publishDate || today,
      status: fullNotice.status || 'Draft',
      targetClassIds: Array.isArray(fullNotice.targetClassIds) ? fullNotice.targetClassIds : [],
      summary: fullNotice.summary || '',
      details: fullNotice.details || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNoticeForm(initialNoticeForm);
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Delete this notice permanently?')) return;
    deleteNoticeMutation.mutate(noticeId);
  };

  const handleQuickUpdate = async (notice, patch) => {
    try {
      const fullNotice = notice.details ? notice : await noticeApi.getById(notice.id);
      updateNoticeMutation.mutate({ id: notice.id, payload: toNoticePayload({ ...fullNotice, ...patch }) });
    } catch (error) {
      setLoadError(error.message || 'Unable to update notice.');
    }
  };

  if (!isCollegeModuleSession(session) || !collegeId) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_42%,#ffffff_100%)] pb-16 text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-600">Notice Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Campus Communication Desk</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError || noticesQuery.error || overviewQuery.error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError || noticesQuery.error?.message || overviewQuery.error?.message}
          </div>
        ) : null}
        <section className="overflow-hidden rounded-3xl bg-[linear-gradient(140deg,#111827_0%,#4c1d95_58%,#0f766e_100%)] p-7 text-white shadow-[0_30px_80px_-42px_rgba(76,29,149,0.8)] lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-violet-100">Official Notice Board</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Publish clear campus updates with audience, priority, schedule, and archive control.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-violet-50/85">
                Manage academic circulars, emergency alerts, event announcements, fee reminders, exam notices, and department updates from one professional desk.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Total Notices" value={stats.total} icon={Megaphone} />
              <MetricCard label="Published" value={stats.published} icon={Send} />
              <MetricCard label="Scheduled" value={stats.scheduled} icon={Clock} />
              <MetricCard label="Urgent" value={stats.urgent} icon={AlertTriangle} />
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] lg:p-8">
            <FormTitle
              title={editingId ? 'Edit Notice' : 'Create Notice'}
              description="Draft, schedule, or publish notices for the right campus audience."
            />

            <form onSubmit={handleSaveNotice} className="mt-7 space-y-5">
              <TextInput
                label="Notice Title"
                value={noticeForm.title}
                onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                placeholder="Example: Mid-semester exam timetable released"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput
                  label="Category"
                  value={noticeForm.category}
                  onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                  options={['General', 'Academic', 'Exam', 'Fees', 'Event', 'Library', 'Transport', 'Hostel', 'Emergency']}
                />
                <SelectInput
                  label="Audience"
                  value={noticeForm.audience}
                  onChange={(e) => setNoticeForm({ ...noticeForm, audience: e.target.value })}
                  options={['All', 'Students', 'Teachers']}
                />
                <SelectInput
                  label="Priority"
                  value={noticeForm.priority}
                  onChange={(e) => setNoticeForm({ ...noticeForm, priority: e.target.value })}
                  options={['Low', 'Normal', 'High', 'Urgent']}
                />
                <SelectInput
                  label="Workflow"
                  value={noticeForm.status}
                  onChange={(e) => setNoticeForm({ ...noticeForm, status: e.target.value })}
                  options={['Draft', 'Published', 'Archived']}
                />
                <TextInput
                  label="Publish Date"
                  type="date"
                  value={noticeForm.publishDate}
                  onChange={(e) => setNoticeForm({ ...noticeForm, publishDate: e.target.value })}
                />
              </div>

              {noticeForm.audience === 'Students' ? (
                <MultiSelectInput
                  label="Target Classes"
                  options={classOptions.map((item) => ({ value: item.classId || item.id, label: item.className || item.name || item.assignedClass }))}
                  values={noticeForm.targetClassIds}
                  onChange={(targetClassIds) => setNoticeForm({ ...noticeForm, targetClassIds })}
                />
              ) : null}

              <TextArea
                label="Short Summary"
                rows="3"
                value={noticeForm.summary}
                onChange={(e) => setNoticeForm({ ...noticeForm, summary: e.target.value })}
                placeholder="Write the short version users see first."
              />
              <TextArea
                label="Full Notice Details"
                rows="6"
                value={noticeForm.details}
                onChange={(e) => setNoticeForm({ ...noticeForm, details: e.target.value })}
                placeholder="Add complete instructions, dates, venue, documents required, or contact information."
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-violet-700"
                >
                  {editingId ? <CheckCircle2 size={15} /> : <Plus size={15} />}
                  {editingId ? 'Update Notice' : 'Save Notice'}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-violet-300 hover:text-violet-700"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <FormTitle title="Notice Register" description={`${noticesQuery.data?.totalElements || 0} notice record(s) found`} />
              <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_150px]">
                <SearchInput value={searchTerm} onChange={setSearchTerm} />
                <SelectInput
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={['All', 'Draft', 'Published', 'Scheduled', 'Archived']}
                />
                <SelectInput
                  label="Audience"
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value)}
                  options={['All', 'Students', 'Teachers']}
                />
                <SelectInput
                  label="Priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  options={['All', 'Urgent', 'High', 'Normal', 'Low']}
                />
              </div>
            </div>

            <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200">
              {filteredNotices.length === 0 ? (
                <div className="p-6">
                  <EmptyState />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 bg-white">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <NoticeTh>Notice</NoticeTh>
                        <NoticeTh>Category</NoticeTh>
                        <NoticeTh>Audience</NoticeTh>
                        <NoticeTh>Priority</NoticeTh>
                        <NoticeTh>Status</NoticeTh>
                        <NoticeTh>Publish</NoticeTh>
                        <NoticeTh noBorder>Actions</NoticeTh>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredNotices.map((notice) => (
                        <NoticeTableRow
                          key={notice.id}
                          notice={notice}
                          onEdit={() => handleEditNotice(notice)}
                          onDelete={() => handleDeleteNotice(notice.id)}
                          onPublish={() => handleQuickUpdate(notice, { status: 'Published' })}
                          onArchive={() => handleQuickUpdate(notice, { status: 'Archived' })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <PaginationBar page={page} totalPages={noticesQuery.data?.totalPages || 1} onPageChange={setPage} />
          </section>
        </div>
      </main>
    </div>
  );
};

const NoticeTableRow = ({ notice, onEdit, onDelete, onPublish, onArchive }) => (
  <tr className="odd:bg-white even:bg-slate-50/70 hover:bg-violet-50/50">
    <NoticeTd>
      <div className="min-w-[260px]">
        <h3 className="text-sm font-black tracking-tight text-slate-950">{notice.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{notice.summary}</p>
      </div>
    </NoticeTd>
    <NoticeTd>{notice.category || '-'}</NoticeTd>
    <NoticeTd>{notice.audience || '-'}</NoticeTd>
    <NoticeTd><PriorityBadge priority={notice.priority} /></NoticeTd>
    <NoticeTd><StatusBadge status={notice.liveStatus} /></NoticeTd>
    <NoticeTd>{formatDate(notice.publishDate)}</NoticeTd>
    <NoticeTd noBorder>
      <div className="flex min-w-[140px] flex-wrap gap-2">
        <IconButton label="Edit" icon={Pencil} onClick={onEdit} />
        {notice.status !== 'Published' ? <IconButton label="Publish" icon={Send} onClick={onPublish} /> : null}
        {notice.status !== 'Archived' ? <IconButton label="Archive" icon={Archive} onClick={onArchive} /> : null}
        <IconButton label="Delete" icon={Trash2} onClick={onDelete} danger />
      </div>
    </NoticeTd>
  </tr>
);

const NoticeTh = ({ children, noBorder = false }) => (
  <th className={`px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] ${noBorder ? '' : 'border-r border-white/10'}`}>
    {children}
  </th>
);

const NoticeTd = ({ children, noBorder = false }) => (
  <td className={`px-4 py-4 align-top text-sm font-semibold text-slate-600 ${noBorder ? '' : 'border-r border-slate-100'}`}>
    {children}
  </td>
);

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-50/80">{label}</p>
        <p className="mt-3 text-4xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const FormTitle = ({ title, description }) => (
  <div>
    <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const TextInput = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      {...props}
    />
  </div>
);

const TextArea = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      {...props}
    />
  </div>
);

const SelectInput = ({ label, options, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
      {...props}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>
);

const MultiSelectInput = ({ label, options, values, onChange }) => {
  const selectedValues = new Set((values || []).map(String));
  return (
    <div className="space-y-2.5">
      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
      <div className="grid gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
        {options.length ? options.filter((option) => option.value).map((option) => {
          const value = String(option.value);
          return (
            <label key={value} className="flex items-center gap-3 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={selectedValues.has(value)}
                onChange={(event) => {
                  const nextValues = event.target.checked
                    ? [...selectedValues, value]
                    : [...selectedValues].filter((item) => item !== value);
                  onChange(nextValues.map(Number).filter(Number.isFinite));
                }}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              {option.label}
            </label>
          );
        }) : (
          <p className="text-sm font-semibold text-slate-500">No active classes found.</p>
        )}
      </div>
    </div>
  );
};

const SearchInput = ({ value, onChange }) => (
  <div className="relative min-w-0">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search notices..."
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
    />
  </div>
);

const PaginationBar = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onPageChange(Math.max(page - 1, 0))}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        Page {page + 1} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
};

const IconButton = ({ label, icon: Icon, onClick, danger = false }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
      danger
        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
        : 'bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700'
    }`}
  >
    <Icon size={16} />
  </button>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getStatusClass(status)}`}>
    {status}
  </span>
);

const PriorityBadge = ({ priority }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getPriorityClass(priority)}`}>
    {priority}
  </span>
);

const EmptyState = ({ title = 'No notices found', description = 'Create a notice or adjust filters to view records.' }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
      <Megaphone size={28} />
    </div>
    <h3 className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

function getLiveStatus(notice) {
  if (notice.status === 'Archived') return 'Archived';
  if (notice.status === 'Draft') return 'Draft';
  if (notice.publishDate && notice.publishDate > today) return 'Scheduled';
  if (notice.expireDate && notice.expireDate < today) return 'Expired';
  return 'Published';
}

function getStatusClass(status) {
  if (status === 'Published') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Scheduled') return 'bg-sky-100 text-sky-700';
  if (status === 'Expired') return 'bg-slate-200 text-slate-600';
  if (status === 'Archived') return 'bg-zinc-200 text-zinc-700';
  return 'bg-amber-100 text-amber-700';
}

function getPriorityClass(priority) {
  if (priority === 'Urgent') return 'bg-rose-100 text-rose-700';
  if (priority === 'High') return 'bg-orange-100 text-orange-700';
  if (priority === 'Low') return 'bg-slate-100 text-slate-600';
  return 'bg-indigo-100 text-indigo-700';
}

function formatDate(value) {
  if (!value) return '-';
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toNoticePayload(notice) {
  return {
    title: notice.title || '',
    category: notice.category || 'General',
    audience: notice.audience || 'All',
    targetClassIds: notice.audience === 'Students' && Array.isArray(notice.targetClassIds) ? notice.targetClassIds : [],
    priority: notice.priority || 'Normal',
    publishDate: notice.publishDate || today,
    expireDate: null,
    status: notice.status || 'Draft',
    isPinned: false,
    summary: notice.summary || '',
    details: notice.details || '',
  };
}

export default NoticeManagement;
