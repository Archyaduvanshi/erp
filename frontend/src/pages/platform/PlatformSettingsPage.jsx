import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { platformApi } from '../../api/platformApi';
import PlatformLayout from '../../components/platform/PlatformLayout';
import { ErrorPanel, PageSkeleton, StatusBadge, formatDate } from '../../components/platform/PlatformUi';

const DEFAULTS = {
  defaultTrialDays: '14',
  defaultPlan: '',
  platformSupportEmail: '',
  platformSupportPhone: '',
  registrationEnabled: 'true',
  reason: '',
};

const toForm = (rows = []) => ({
  ...DEFAULTS,
  ...Object.fromEntries(rows.map(row => [row.key, row.value ?? ''])),
  reason: '',
});

const updatedAt = (rows = [], key) => rows.find(row => row.key === key)?.updatedAt;
const isEnabled = value => String(value ?? 'true').toLowerCase() === 'true';

export default function PlatformSettingsPage() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['platform', 'settings'], queryFn: platformApi.settings });
  const plans = useQuery({ queryKey: ['platform', 'plans'], queryFn: platformApi.plans });
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (settings.data) setForm(toForm(settings.data));
  }, [settings.data]);

  const activePlans = useMemo(() => (plans.data || []).filter(plan => plan.status === 'ACTIVE'), [plans.data]);
  const selectedPlan = activePlans.find(plan => plan.code === form.defaultPlan);
  const registrationOpen = isEnabled(form.registrationEnabled);
  const hasSupportEmail = Boolean(form.platformSupportEmail.trim());
  const hasChanges = settings.data ? JSON.stringify({ ...toForm(settings.data), reason: form.reason }) !== JSON.stringify(form) : false;

  const save = useMutation({
    mutationFn: platformApi.updateSettings,
    onSuccess: data => {
      client.setQueryData(['platform', 'settings'], data);
      client.invalidateQueries({ queryKey: ['public', 'config'] });
      setForm(toForm(data));
    },
  });

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = event => {
    event.preventDefault();
    if (save.isPending) return;
    save.mutate({
      ...form,
      defaultTrialDays: String(form.defaultTrialDays || '').trim(),
      defaultPlan: String(form.defaultPlan || '').trim().toUpperCase(),
      platformSupportEmail: form.platformSupportEmail.trim(),
      platformSupportPhone: form.platformSupportPhone.trim(),
      registrationEnabled: String(form.registrationEnabled),
      reason: form.reason.trim(),
    });
  };

  if (settings.isLoading) return <PlatformLayout title="Platform Settings"><PageSkeleton /></PlatformLayout>;

  return <PlatformLayout title="Platform Settings" subtitle="Manage public registration, support routing and default subscription behavior">
    {settings.isError ? <ErrorPanel error={settings.error} retry={settings.refetch} /> : <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCard icon={registrationOpen ? ToggleRight : ToggleLeft} label="Registration" value={registrationOpen ? 'Open' : 'Paused'} tone={registrationOpen ? 'emerald' : 'rose'} detail={registrationOpen ? 'Public signups can continue.' : 'Direct signup route is guarded.'} />
        <SummaryCard icon={GraduationCap} label="Default Plan" value={selectedPlan?.name || form.defaultPlan || 'Not set'} detail={selectedPlan ? `${selectedPlan.trialDays} plan trial days` : 'Choose an active plan.'} />
        <SummaryCard icon={Clock3} label="Default Trial" value={`${form.defaultTrialDays || 0} days`} detail="Used when registration provisions a workspace." />
        <SummaryCard icon={Bell} label="Demo Alerts" value={hasSupportEmail ? 'Configured' : 'Pending'} tone={hasSupportEmail ? 'emerald' : 'amber'} detail={hasSupportEmail ? form.platformSupportEmail : 'Add support email to receive demo requests.'} />
      </div>

      {save.isSuccess && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800"><CheckCircle2 size={18} />Settings saved.</div>}
      {save.isError && <ErrorPanel error={save.error} />}

      <div className="grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          <SettingsPanel title="Registration & Trial" icon={ShieldCheck} description="Controls the public registration flow and the subscription assigned during onboarding.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Registration">
                <select value={form.registrationEnabled || 'true'} onChange={event => set('registrationEnabled', event.target.value)} className={inputClass}>
                  <option value="true">Enabled</option>
                  <option value="false">Paused</option>
                </select>
              </Field>
              <Field label="Default Trial Days">
                <input type="number" min="0" max="365" step="1" value={form.defaultTrialDays || ''} onChange={event => set('defaultTrialDays', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Default Plan">
                <select value={form.defaultPlan || ''} onChange={event => set('defaultPlan', event.target.value)} disabled={plans.isLoading || plans.isError} className={inputClass}>
                  <option value="">{plans.isLoading ? 'Loading active plans...' : 'Select active plan'}</option>
                  {activePlans.map(plan => <option key={plan.id} value={plan.code}>{plan.name} ({plan.code})</option>)}
                </select>
              </Field>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Selected Plan</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{selectedPlan?.name || 'No active plan selected'}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedPlan ? `${selectedPlan.features.length} features included` : 'Create or activate a plan first.'}</p>
                  </div>
                  {selectedPlan && <StatusBadge value={selectedPlan.status} />}
                </div>
              </div>
            </div>
            {plans.isError && <div className="mt-5"><ErrorPanel error={plans.error} retry={plans.refetch} /></div>}
          </SettingsPanel>

          <SettingsPanel title="Support & Demo Routing" icon={Mail} description="Public demo requests are stored and emailed to the configured support inbox.">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Support Email">
                <div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="email" value={form.platformSupportEmail || ''} onChange={event => set('platformSupportEmail', event.target.value)} placeholder="support@example.com" className={`${inputClass} pl-11`} /></div>
              </Field>
              <Field label="Support Phone">
                <div className="relative"><Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={form.platformSupportPhone || ''} onChange={event => set('platformSupportPhone', event.target.value)} placeholder="+91 9876543210" className={`${inputClass} pl-11`} /></div>
              </Field>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Demo requests remain saved in the database even when email delivery is not configured. Add a support email to let the background notification job deliver them.
            </div>
          </SettingsPanel>
        </section>

        <aside className="space-y-6">
          <SettingsPanel title="Save Changes" icon={Save} description="Every update is written to the platform audit log.">
            <Field label="Change Reason">
              <textarea required maxLength={500} rows={5} value={form.reason || ''} onChange={event => set('reason', event.target.value)} placeholder="Example: Updated demo inbox and default onboarding plan." className={`${inputClass} h-auto py-3`} />
            </Field>
            <button type="submit" disabled={!form.reason?.trim() || !form.defaultPlan || plans.isLoading || plans.isError || save.isPending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-4 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-40">
              {save.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {save.isPending ? 'Saving Settings' : 'Save Settings'}
            </button>
            <p className="mt-3 text-xs font-semibold text-slate-500">{hasChanges ? 'Unsaved changes are ready to submit.' : 'No unsaved changes.'}</p>
          </SettingsPanel>

          <SettingsPanel title="Last Updated" icon={Clock3} description="Recent timestamps from stored platform settings.">
            <div className="space-y-3">
              <MetaRow label="Registration" value={formatDate(updatedAt(settings.data, 'registrationEnabled'))} />
              <MetaRow label="Default Plan" value={formatDate(updatedAt(settings.data, 'defaultPlan'))} />
              <MetaRow label="Support Email" value={formatDate(updatedAt(settings.data, 'platformSupportEmail'))} />
              <MetaRow label="Support Phone" value={formatDate(updatedAt(settings.data, 'platformSupportPhone'))} />
            </div>
          </SettingsPanel>
        </aside>
      </div>
    </form>}
  </PlatformLayout>;
}

const inputClass = 'mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 disabled:bg-slate-100 disabled:text-slate-400';

function SettingsPanel({ title, icon: Icon, description, children }) {
  return <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/30">
    <div className="mb-5 flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={20} /></span>
      <div>
        <h2 className="font-serif text-2xl font-black italic text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
    {children}
  </section>;
}

function SummaryCard({ icon: Icon, label, value, detail, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/20">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={`rounded-xl p-2 ${tones[tone] || tones.slate}`}><Icon size={18} /></span>
    </div>
    <p className="mt-4 truncate text-xl font-black text-slate-950">{value}</p>
    <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{detail}</p>
  </article>;
}

function Field({ label, children }) {
  return <label className="block">
    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    {children}
  </label>;
}

function MetaRow({ label, value }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
    <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
    <span className="text-sm font-bold text-slate-800">{value}</span>
  </div>;
}
