import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { noticeApi } from '../../utils/api';

const today = new Date().toISOString().split('T')[0];
const isCollegeModuleSession = (session) => session?.role === 'admin' || session?.role === 'feature';

const initialNoticeForm = {
  title: '',
  category: 'General',
  audience: 'All',
  priority: 'Normal',
  publishDate: today,
  expireDate: '',
  status: 'Draft',
  isPinned: false,
  summary: '',
  details: '',
};

const NoticeManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [collegeId] = useState(() => localStorage.getItem('current_college_id'));
  const [notices, setNotices] = useState([]);
  const [noticeForm, setNoticeForm] = useState(initialNoticeForm);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [selectedNoticeId, setSelectedNoticeId] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isCollegeModuleSession(session) || !collegeId) {
      navigate('/login');
      return;
    }

    refreshData();
  }, [collegeId, navigate, session]);

  const refreshData = async () => {
    try {
      const records = await noticeApi.getAll();
      const visibleRecords = records.filter((notice) => !notice.targetStudentId && !notice.targetTeacherId);
      setNotices(visibleRecords);
      setSelectedNoticeId((currentId) => (
        currentId && visibleRecords.some((notice) => String(notice.id) === String(currentId)) ? currentId : visibleRecords[0]?.id || null
      ));
      setLoadError('');
    } catch (error) {
      setNotices([]);
      setLoadError(error.message || 'Unable to load notices.');
    }
  };

  const enrichedNotices = useMemo(() => (
    notices.map((notice) => ({
      ...notice,
      liveStatus: getLiveStatus(notice),
    }))
  ), [notices]);

  const filteredNotices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return enrichedNotices
      .filter((notice) => {
        const matchesStatus = statusFilter === 'All' || notice.liveStatus === statusFilter || notice.status === statusFilter;
        const matchesAudience = audienceFilter === 'All' || notice.audience === audienceFilter;
        if (!matchesStatus || !matchesAudience) return false;
        if (!query) return true;

        return (
          notice.title?.toLowerCase().includes(query) ||
          notice.category?.toLowerCase().includes(query) ||
          notice.audience?.toLowerCase().includes(query) ||
          notice.priority?.toLowerCase().includes(query) ||
          notice.summary?.toLowerCase().includes(query) ||
          notice.details?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.publishDate || b.createdAt || 0) - new Date(a.publishDate || a.createdAt || 0);
      });
  }, [audienceFilter, enrichedNotices, searchTerm, statusFilter]);

  const selectedNotice = useMemo(() => (
    enrichedNotices.find((notice) => String(notice.id) === String(selectedNoticeId)) || filteredNotices[0] || null
  ), [enrichedNotices, filteredNotices, selectedNoticeId]);

  const stats = useMemo(() => ({
    total: notices.length,
    published: enrichedNotices.filter((notice) => notice.liveStatus === 'Published').length,
    scheduled: enrichedNotices.filter((notice) => notice.liveStatus === 'Scheduled').length,
    urgent: enrichedNotices.filter((notice) => notice.priority === 'Urgent').length,
  }), [enrichedNotices, notices.length]);

  const handleSaveNotice = async (e) => {
    e.preventDefault();

    const payload = {
      ...noticeForm,
      title: noticeForm.title.trim(),
      expireDate: noticeForm.expireDate || null,
      summary: noticeForm.summary.trim(),
      details: noticeForm.details.trim(),
    };

    if (!payload.title || !payload.publishDate || !payload.summary || !payload.details) return;

    try {
      if (editingId) {
        await noticeApi.update(editingId, payload);
      } else {
        await noticeApi.create(payload);
      }

      setNoticeForm(initialNoticeForm);
      setEditingId(null);
      await refreshData();
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save notice.');
    }
  };

  const handleEditNotice = (notice) => {
    setEditingId(notice.id);
    setNoticeForm({
      title: notice.title || '',
      category: notice.category || 'General',
      audience: notice.audience || 'All',
      priority: notice.priority || 'Normal',
      publishDate: notice.publishDate || today,
      expireDate: notice.expireDate || '',
      status: notice.status || 'Draft',
      isPinned: Boolean(notice.isPinned),
      summary: notice.summary || '',
      details: notice.details || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNoticeForm(initialNoticeForm);
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('Delete this notice permanently?')) return;
    try {
      await noticeApi.delete(noticeId);
      await refreshData();
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete notice.');
    }
  };

  const handleQuickUpdate = async (notice, patch) => {
    try {
      await noticeApi.update(notice.id, toNoticePayload({ ...notice, ...patch }));
      await refreshData();
      setLoadError('');
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
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
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

        <div className="mt-8 grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] lg:p-8">
            <FormTitle
              title={editingId ? 'Edit Notice' : 'Create Notice'}
              description="Draft, schedule, publish, or pin notices for the right campus audience."
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
                  options={['All', 'Students', 'Teachers', 'Parents', 'Staff']}
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
                <TextInput
                  label="Expiry Date"
                  type="date"
                  value={noticeForm.expireDate}
                  onChange={(e) => setNoticeForm({ ...noticeForm, expireDate: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={noticeForm.isPinned}
                  onChange={(e) => setNoticeForm({ ...noticeForm, isPinned: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                Pin this notice to the top
              </label>

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

          <section className="space-y-8">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <FormTitle title="Notice Register" description={`${filteredNotices.length} notice record(s) found`} />
                <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
                  <SearchInput value={searchTerm} onChange={setSearchTerm} />
                  <SelectInput
                    label="Status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    options={['All', 'Draft', 'Published', 'Scheduled', 'Expired', 'Archived']}
                  />
                  <SelectInput
                    label="Audience"
                    value={audienceFilter}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    options={['All', 'Students', 'Teachers', 'Parents', 'Staff']}
                  />
                </div>
              </div>

              <div className="mt-7 space-y-4">
                {filteredNotices.length === 0 ? (
                  <EmptyState />
                ) : (
                  filteredNotices.map((notice) => (
                    <NoticeRow
                      key={notice.id}
                      notice={notice}
                      isSelected={String(selectedNotice?.id) === String(notice.id)}
                      onSelect={() => setSelectedNoticeId(notice.id)}
                      onEdit={() => handleEditNotice(notice)}
                      onDelete={() => handleDeleteNotice(notice.id)}
                      onTogglePin={() => handleQuickUpdate(notice, { isPinned: !notice.isPinned })}
                      onPublish={() => handleQuickUpdate(notice, { status: 'Published' })}
                      onArchive={() => handleQuickUpdate(notice, { status: 'Archived' })}
                    />
                  ))
                )}
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] lg:p-8">
              <FormTitle title="Live Preview" description="Selected notice preview for student, teacher, and staff portals." />
              {selectedNotice ? (
                <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedNotice.liveStatus} />
                    <PriorityBadge priority={selectedNotice.priority} />
                    {selectedNotice.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-700"><Pin size={12} />Pinned</span> : null}
                  </div>
                  <h3 className="mt-5 font-serif text-3xl font-black italic tracking-tight text-slate-950">{selectedNotice.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{selectedNotice.summary}</p>
                  <div className="mt-5 grid gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500 sm:grid-cols-3">
                    <InfoPill icon={Users} label={selectedNotice.audience} />
                    <InfoPill icon={CalendarDays} label={formatDate(selectedNotice.publishDate)} />
                    <InfoPill icon={Archive} label={selectedNotice.expireDate ? `Till ${formatDate(selectedNotice.expireDate)}` : 'No expiry'} />
                  </div>
                  <p className="mt-6 whitespace-pre-line rounded-2xl bg-white p-5 text-sm leading-7 text-slate-600">
                    {selectedNotice.details}
                  </p>
                </div>
              ) : (
                <EmptyState title="No notice selected" description="Create or select a notice to preview it here." />
              )}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
};

const NoticeRow = ({ notice, isSelected, onSelect, onEdit, onDelete, onTogglePin, onPublish, onArchive }) => (
  <article className={`rounded-2xl border p-4 transition ${isSelected ? 'border-violet-300 bg-violet-50/60' : 'border-slate-200 bg-white hover:border-violet-200'}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={notice.liveStatus} />
          <PriorityBadge priority={notice.priority} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">{notice.audience}</span>
          {notice.isPinned ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-700"><Pin size={12} />Pinned</span> : null}
        </div>
        <h3 className="mt-3 text-lg font-black tracking-tight text-slate-950">{notice.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{notice.summary}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
          <span>{notice.category}</span>
          <span>Publish: {formatDate(notice.publishDate)}</span>
          <span>Expiry: {notice.expireDate ? formatDate(notice.expireDate) : 'None'}</span>
        </div>
      </button>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <IconButton label={notice.isPinned ? 'Unpin' : 'Pin'} icon={Pin} onClick={onTogglePin} />
        <IconButton label="Preview" icon={Eye} onClick={onSelect} />
        <IconButton label="Edit" icon={Pencil} onClick={onEdit} />
        {notice.status !== 'Published' ? <IconButton label="Publish" icon={Send} onClick={onPublish} /> : null}
        {notice.status !== 'Archived' ? <IconButton label="Archive" icon={Archive} onClick={onArchive} /> : null}
        <IconButton label="Delete" icon={Trash2} onClick={onDelete} danger />
      </div>
    </div>
  </article>
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

const InfoPill = ({ icon: Icon, label }) => (
  <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
    <Icon size={14} />
    {label}
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
    priority: notice.priority || 'Normal',
    publishDate: notice.publishDate || today,
    expireDate: notice.expireDate || null,
    status: notice.status || 'Draft',
    isPinned: Boolean(notice.isPinned),
    summary: notice.summary || '',
    details: notice.details || '',
  };
}

export default NoticeManagement;
