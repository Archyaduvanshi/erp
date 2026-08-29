import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Lock,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { instituteApi, settingsApi, teacherApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const profileFields = [
  'instituteName',
  'type',
  'affiliationNo',
  'affiliatedFrom',
  'contact',
  'email',
  'website',
  'address',
  'state',
  'city',
  'pincode',
];

const uppercaseProfileFields = ['instituteName', 'affiliationNo', 'affiliatedFrom', 'address', 'state', 'city'];
const digitProfileFields = { contact: 10, pincode: 6 };
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordMessage = 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol.';

const defaultPreferences = {
  academicYear: '2026-2027',
  academicYearStartMonth: 'April',
  academicYearEndMonth: 'March',
  workingDays: 'Monday To Saturday',
  timezone: 'Asia/Kolkata',
  language: 'English',
  dateFormat: 'DD/MM/YYYY',
  currency: 'INR',
  theme: 'Light',
  studentCodePrefix: 'STU',
  teacherCodePrefix: 'TCH',
};

const monthOptions = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const defaultNotifications = {
  emailNotice: true,
  smsAlerts: false,
  holidayNotice: true,
  feeReminders: true,
  attendanceAlerts: true,
};

const featureAccessOptions = [
  { value: 'admissionStudent', label: 'Admission Student' },
  { value: 'teacher', label: 'Teacher Management' },
  { value: 'library', label: 'Library Management' },
  { value: 'hostel', label: 'Hostel Management' },
  { value: 'fees', label: 'Fees Management' },
  { value: 'transport', label: 'Transport Management' },
  { value: 'attendance', label: 'Attendance Management' },
  { value: 'courses', label: 'Course & Subject' },
  { value: 'examinations', label: 'Examination Management' },
  { value: 'timetable', label: 'Timetable Management' },
  { value: 'salary', label: 'Salary Management' },
  { value: 'notices', label: 'Notice Management' },
  { value: 'holidays', label: 'Holiday Management' },
];

const defaultFeatureAccess = featureAccessOptions.reduce((access, feature) => ({
  ...access,
  [feature.value]: { enabled: false, passwordSet: false },
}), {});

const initialProfile = {
  instituteName: '',
  type: 'College',
  affiliationNo: '',
  affiliatedFrom: '',
  contact: '',
  email: '',
  website: '',
  address: '',
  state: '',
  city: '',
  pincode: '',
};

const SettingsManagement = () => {
  const navigate = useNavigate();
  const { session, acceptLogin } = useAuth();
  const collegeId = session?.id || '';
  const [institute, setInstitute] = useState(null);
  const [profileForm, setProfileForm] = useState(initialProfile);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [featureAccess, setFeatureAccess] = useState(defaultFeatureAccess);
  const [featureAccessRecords, setFeatureAccessRecords] = useState([]);
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [featureAccessForm, setFeatureAccessForm] = useState({ feature: '', teacherId: '', operation: 'read', enabled: true });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [visiblePassword, setVisiblePassword] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [featureAccessErrors, setFeatureAccessErrors] = useState({});

  useEffect(() => {
    if (!session || session.role !== 'admin' || !collegeId) {
      navigate('/login');
      return;
    }

    loadSettings();
  }, [collegeId, navigate, session]);

  const loadSettings = async () => {
    try {
      const [serverInstitute, serverSettings] = await Promise.all([
        instituteApi.getById(collegeId),
        settingsApi.get(),
      ]);
      setTeacherOptions(await loadTeacherOptions());
      hydrateInstitute(serverInstitute || session);
      hydrateSettings(serverSettings);
    } catch {
      hydrateInstitute(session);
      setTeacherOptions(await loadTeacherOptions());
    }
  };

  const loadTeacherOptions = async () => {
    try {
      const teachers = await teacherApi.getAll();
      if (Array.isArray(teachers) && teachers.length) {
        return teachers
          .filter((teacher) => String(teacher.status || 'Active').toLowerCase() === 'active')
          .map((teacher) => ({
            id: teacher.id,
            employeeId: teacher.employeeId,
            name: teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
            mobileNumber: teacher.mobileNumber,
            dob: teacher.dob,
          }));
      }
    } catch {
      // Fall back to compact teacher options below.
    }

    try {
      const options = await teacherApi.getOptions('Active');
      return Array.isArray(options) ? options : [];
    } catch {
      return [];
    }
  };

  const hydrateSettings = (settings) => {
    setPreferences({ ...defaultPreferences, ...(settings?.preferences || {}) });
    setNotifications({ ...defaultNotifications, ...(settings?.notifications || {}) });
    const records = settings?.featureAccess || [];
    setFeatureAccessRecords(records);
    setFeatureAccess(toFeatureAccessMap(records));
  };

  const hydrateInstitute = (record) => {
    const nextInstitute = record || {};
    setInstitute(nextInstitute);
    setProfileForm(profileFields.reduce((form, field) => ({
      ...form,
      [field]: nextInstitute[field] || initialProfile[field] || '',
    }), {}));
  };

  const updateProfileField = (field, rawValue) => {
    let value = rawValue;
    if (uppercaseProfileFields.includes(field)) value = rawValue.toUpperCase();
    if (digitProfileFields[field]) value = rawValue.replace(/\D/g, '').slice(0, digitProfileFields[field]);

    setProfileForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    clearStatus();
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const errors = validateProfile(profileForm);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('Please fix the highlighted profile fields.');
      setMessage('');
      return;
    }

    try {
      const updatedInstitute = await instituteApi.update(collegeId, profileForm);
      acceptLogin({
        ...session,
        username: updatedInstitute.username,
        instituteName: updatedInstitute.instituteName,
        type: updatedInstitute.type,
        logo: updatedInstitute.logo,
        role: 'admin',
      });
      setInstitute(updatedInstitute);
      setFieldErrors({});
      setError('');
      setMessage('Institution profile saved successfully.');
    } catch (apiError) {
      setFieldErrors(apiError.fieldErrors || {});
      setError(apiError.message || 'Unable to save institution profile.');
      setMessage('');
    }
  };

  const savePreferences = async () => {
    try {
      const settings = await settingsApi.savePreferences(preferences);
      hydrateSettings(settings);
      setError('');
      setMessage('Platform preferences saved successfully.');
    } catch (apiError) {
      setError(apiError.message || 'Unable to save preferences.');
      setMessage('');
    }
  };

  const saveNotifications = async () => {
    try {
      const settings = await settingsApi.saveNotifications(notifications);
      hydrateSettings(settings);
      setError('');
      setMessage('Notification settings saved successfully.');
    } catch (apiError) {
      setError(apiError.message || 'Unable to save notifications.');
      setMessage('');
    }
  };

  const saveFeatureAccess = async (event) => {
    event.preventDefault();
    if (!featureAccessForm.feature) {
      setFeatureAccessErrors({ feature: 'Please select a feature.' });
      setError('Please select a feature.');
      setMessage('');
      return;
    }
    if (!featureAccessForm.teacherId) {
      setFeatureAccessErrors({ teacherId: 'Please select teacher.' });
      setError('Please select teacher.');
      setMessage('');
      return;
    }
    if (!featureAccessForm.operation) {
      setFeatureAccessErrors({ operation: 'Please select operation.' });
      setError('Please select operation.');
      setMessage('');
      return;
    }
    try {
      await settingsApi.saveFeatureAccess(featureAccessForm);
      const settings = await settingsApi.get();
      hydrateSettings(settings);
      setFeatureAccessErrors({});
      setError('');
      setMessage('Feature permission saved successfully.');
    } catch (apiError) {
      setFeatureAccessErrors(apiError.fieldErrors || {});
      setError(apiError.message || 'Unable to save feature permission.');
      setMessage('');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!passwordForm.currentPassword) errors.currentPassword = 'Enter current password.';
    if (!passwordPattern.test(passwordForm.newPassword)) {
      errors.newPassword = passwordMessage;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'New password and confirm password do not match.';
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('Please fix the highlighted password fields.');
      setMessage('');
      return;
    }

    try {
      await instituteApi.changePassword(collegeId, passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setFieldErrors({});
      setError('');
      setMessage('Admin password updated successfully.');
    } catch (apiError) {
      setFieldErrors(apiError.fieldErrors || {});
      setError(apiError.message || 'Unable to update admin password.');
      setMessage('');
    }
  };

  const resetPreferences = async () => {
    if (!window.confirm('Reset preferences and notifications to default values?')) return;
    try {
      await settingsApi.reset();
      setPreferences(defaultPreferences);
      setNotifications(defaultNotifications);
      setFeatureAccessRecords([]);
      setFeatureAccess(defaultFeatureAccess);
      setMessage('Settings reset to default values.');
      setError('');
    } catch (apiError) {
      setError(apiError.message || 'Unable to reset settings.');
      setMessage('');
    }
  };

  const exportSettings = () => {
    const payload = {
      institute: { ...(institute || {}), password: undefined },
      preferences,
      notifications,
      featureAccess,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profileForm.instituteName || 'college'}-settings.json`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Settings export downloaded.');
    setError('');
  };

  const clearStatus = () => {
    setError('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#ffffff_100%)] pb-16 text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-600">College Settings</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Institution Control Panel</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {message ? <StatusBanner tone="success" text={message} /> : null}
        {error ? <StatusBanner tone="error" text={error} /> : null}

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-4xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
            {[
              ['profile', 'Profile', Landmark],
              ['preferences', 'Preferences', Palette],
              ['notifications', 'Notifications', Bell],
              ['featureAccess', 'Feature Access', KeyRound],
              ['security', 'Security', ShieldCheck],
              ['data', 'Data Controls', Database],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveTab(key);
                  clearStatus();
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] transition ${
                  activeTab === key ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-700'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </aside>

          <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            {activeTab === 'profile' ? (
              <form onSubmit={saveProfile}>
                <PanelTitle icon={Landmark} title="Institution Profile" description="Update the details shown across the admin dashboard and local session." />
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <TextInput label="Institution Name" value={profileForm.instituteName} onChange={(e) => updateProfileField('instituteName', e.target.value)} error={fieldErrors.instituteName} />
                  <SelectInput label="Institution Type" value={profileForm.type} onChange={(e) => updateProfileField('type', e.target.value)} options={['College', 'School', 'University', 'Institute']} error={fieldErrors.type} />
                  <TextInput label="Affiliation No." value={profileForm.affiliationNo} onChange={(e) => updateProfileField('affiliationNo', e.target.value)} error={fieldErrors.affiliationNo} />
                  <TextInput label="Affiliated From" value={profileForm.affiliatedFrom} onChange={(e) => updateProfileField('affiliatedFrom', e.target.value)} error={fieldErrors.affiliatedFrom} />
                  <TextInput label="Contact Number" value={profileForm.contact} onChange={(e) => updateProfileField('contact', e.target.value)} inputMode="numeric" error={fieldErrors.contact} />
                  <TextInput label="Official Email" value={profileForm.email} onChange={(e) => updateProfileField('email', e.target.value)} error={fieldErrors.email} />
                  <TextInput label="Website" value={profileForm.website} onChange={(e) => updateProfileField('website', e.target.value)} error={fieldErrors.website} />
                  <TextInput label="State" value={profileForm.state} onChange={(e) => updateProfileField('state', e.target.value)} error={fieldErrors.state} />
                  <TextInput label="City" value={profileForm.city} onChange={(e) => updateProfileField('city', e.target.value)} error={fieldErrors.city} />
                  <TextInput label="Pincode" value={profileForm.pincode} onChange={(e) => updateProfileField('pincode', e.target.value)} inputMode="numeric" error={fieldErrors.pincode} />
                  <div className="md:col-span-2 xl:col-span-3">
                    <TextArea label="Address" value={profileForm.address} onChange={(e) => updateProfileField('address', e.target.value)} error={fieldErrors.address} />
                  </div>
                </div>
                <ActionRow>
                  <ActionButton type="submit" icon={Save} label="Save Profile" />
                </ActionRow>
              </form>
            ) : null}

            {activeTab === 'preferences' ? (
              <div>
                <PanelTitle icon={Palette} title="Platform Preferences" description="Set the default working values used by the admin workspace." />
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <TextInput label="Academic Year" value={preferences.academicYear} onChange={(e) => setPreferences({ ...preferences, academicYear: e.target.value.toUpperCase() })} />
                  <SelectInput label="Academic Year Start Month" value={preferences.academicYearStartMonth} onChange={(e) => setPreferences({ ...preferences, academicYearStartMonth: e.target.value })} options={monthOptions} />
                  <SelectInput label="Academic Year End Month" value={preferences.academicYearEndMonth} onChange={(e) => setPreferences({ ...preferences, academicYearEndMonth: e.target.value })} options={monthOptions} />
                  <SelectInput label="Working Days" value={preferences.workingDays} onChange={(e) => setPreferences({ ...preferences, workingDays: e.target.value })} options={['Monday To Friday', 'Monday To Saturday', 'All Days']} />
                  <SelectInput label="Timezone" value={preferences.timezone} onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })} options={['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London']} />
                  <SelectInput label="Language" value={preferences.language} onChange={(e) => setPreferences({ ...preferences, language: e.target.value })} options={['English', 'Hindi']} />
                  <SelectInput label="Date Format" value={preferences.dateFormat} onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })} options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} />
                  <SelectInput label="Currency" value={preferences.currency} onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })} options={['INR', 'USD', 'EUR']} />
                  <SelectInput label="Theme" value={preferences.theme} onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })} options={['Light', 'System', 'Dark']} />
                  <TextInput label="Student Code Prefix" value={preferences.studentCodePrefix} onChange={(e) => setPreferences({ ...preferences, studentCodePrefix: e.target.value.toUpperCase() })} />
                  <TextInput label="Teacher Code Prefix" value={preferences.teacherCodePrefix} onChange={(e) => setPreferences({ ...preferences, teacherCodePrefix: e.target.value.toUpperCase() })} />
                </div>
                <ActionRow>
                  <ActionButton type="button" icon={Save} label="Save Preferences" onClick={savePreferences} />
                </ActionRow>
              </div>
            ) : null}

            {activeTab === 'notifications' ? (
              <div>
                <PanelTitle icon={Bell} title="Notification Settings" description="Choose which college events should generate alerts." />
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <Toggle label="Email Notices" checked={notifications.emailNotice} onChange={() => setNotifications({ ...notifications, emailNotice: !notifications.emailNotice })} />
                  <Toggle label="SMS Alerts" checked={notifications.smsAlerts} onChange={() => setNotifications({ ...notifications, smsAlerts: !notifications.smsAlerts })} />
                  <Toggle label="Holiday Notices" checked={notifications.holidayNotice} onChange={() => setNotifications({ ...notifications, holidayNotice: !notifications.holidayNotice })} />
                  <Toggle label="Fee Reminders" checked={notifications.feeReminders} onChange={() => setNotifications({ ...notifications, feeReminders: !notifications.feeReminders })} />
                  <Toggle label="Attendance Alerts" checked={notifications.attendanceAlerts} onChange={() => setNotifications({ ...notifications, attendanceAlerts: !notifications.attendanceAlerts })} />
                </div>
                <ActionRow>
                  <ActionButton type="button" icon={Save} label="Save Notifications" onClick={saveNotifications} />
                </ActionRow>
              </div>
            ) : null}

            {activeTab === 'security' ? (
              <form onSubmit={changePassword}>
                <PanelTitle icon={ShieldCheck} title="Security" description="Change the admin password saved for this college login." />
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <PasswordInput label="Current Password" field="currentPassword" form={passwordForm} setForm={setPasswordForm} visiblePassword={visiblePassword} setVisiblePassword={setVisiblePassword} error={fieldErrors.currentPassword} />
                  <PasswordInput label="New Password" field="newPassword" form={passwordForm} setForm={setPasswordForm} visiblePassword={visiblePassword} setVisiblePassword={setVisiblePassword} error={fieldErrors.newPassword} />
                  <PasswordInput label="Confirm Password" field="confirmPassword" form={passwordForm} setForm={setPasswordForm} visiblePassword={visiblePassword} setVisiblePassword={setVisiblePassword} error={fieldErrors.confirmPassword} />
                </div>
                <ActionRow>
                  <ActionButton type="submit" icon={Lock} label="Update Password" />
                </ActionRow>
              </form>
            ) : null}

            {activeTab === 'featureAccess' ? (
              <div>
                <PanelTitle icon={KeyRound} title="Feature Access" description="Select feature, teacher, and operation permission for teacher dashboard management cards." />
                <form className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={saveFeatureAccess}>
                  <SelectInput
                    label="Select Feature"
                    value={featureAccessForm.feature}
                    onChange={(event) => {
                      const selectedFeature = event.target.value;
                      setFeatureAccessErrors((current) => ({ ...current, feature: '' }));
                      clearStatus();
                      setFeatureAccessForm({
                        ...featureAccessForm,
                        feature: selectedFeature,
                        operation: featureAccess[selectedFeature]?.operation || 'read',
                        enabled: featureAccess[selectedFeature]?.enabled ?? true,
                      });
                    }}
                    options={['', ...featureAccessOptions.map((feature) => feature.value)]}
                    renderOptionLabel={(value) => featureAccessOptions.find((feature) => feature.value === value)?.label || 'Select'}
                    error={featureAccessErrors.feature}
                  />
                  <SelectInput
                    label="Select Teacher"
                    value={featureAccessForm.teacherId}
                    onChange={(event) => {
                      setFeatureAccessForm({ ...featureAccessForm, teacherId: event.target.value });
                      setFeatureAccessErrors((current) => ({ ...current, teacherId: '' }));
                      clearStatus();
                    }}
                    options={['', ...teacherOptions.map((teacher) => String(teacher.id))]}
                    renderOptionLabel={(value) => {
                      if (!value) return teacherOptions.length ? 'Select teacher' : 'No active teachers';
                      const teacher = teacherOptions.find((entry) => String(entry.id) === String(value));
                      return teacher ? `${teacher.name || teacher.teacherName || 'Teacher'} | ${teacher.employeeId || '-'}` : 'Select teacher';
                    }}
                    error={featureAccessErrors.teacherId}
                  />
                  <SelectInput
                    label="Operation"
                    value={featureAccessForm.operation}
                    onChange={(event) => {
                      setFeatureAccessForm({ ...featureAccessForm, operation: event.target.value });
                      setFeatureAccessErrors((current) => ({ ...current, operation: '' }));
                      clearStatus();
                    }}
                    options={['read', 'read_write']}
                    renderOptionLabel={(value) => value === 'read_write' ? 'Read + Write' : 'Read Only'}
                    error={featureAccessErrors.operation}
                  />
                  <Toggle
                    label={featureAccessForm.enabled ? 'Access Enabled' : 'Access Disabled'}
                    checked={featureAccessForm.enabled}
                    onChange={() => setFeatureAccessForm({ ...featureAccessForm, enabled: !featureAccessForm.enabled })}
                  />
                  <div className="md:col-span-2 xl:col-span-3">
                    <ActionButton type="submit" icon={Save} label="Save Feature Permission" />
                  </div>
                </form>

                <div className="mt-8 overflow-x-auto rounded-[1.6rem] border border-slate-200">
                  <table className="min-w-[620px] w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Feature', 'Teacher', 'Operation', 'Status'].map((heading) => (
                          <th key={heading} className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {featureAccessRecords.length ? featureAccessRecords.map((access) => {
                        const feature = featureAccessOptions.find((option) => option.value === access.feature);
                        return (
                          <tr key={`${access.feature}-${access.teacherId || 'legacy'}`}>
                            <td className="px-4 py-4 text-sm font-black uppercase text-slate-950">{feature?.label || access.feature}</td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">{access.teacherName ? `${access.teacherName} | ${access.employeeId || '-'}` : 'Legacy password access'}</td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">{access.operation === 'read_write' ? 'Read + Write' : 'Read Only'}</td>
                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">{access.enabled ? 'Enabled' : 'Disabled'}</td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No feature permission assigned yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {activeTab === 'data' ? (
              <div>
                <PanelTitle icon={Database} title="Data Controls" description="Export settings or reset this page's preferences." />
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <ControlButton icon={Download} title="Export Settings" description="Download profile, preferences, and notification values as JSON." onClick={exportSettings} />
                  <ControlButton icon={RefreshCw} title="Reset Preferences" description="Restore default preferences and notification toggles." onClick={resetPreferences} danger />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
};

const validateProfile = (form) => {
  const errors = {};
  ['instituteName', 'type', 'contact', 'email', 'address', 'state', 'city', 'pincode'].forEach((field) => {
    if (!String(form[field] || '').trim()) errors[field] = 'This field is required.';
  });
  if (form.contact && !/^\d{10}$/.test(form.contact)) errors.contact = 'Contact number must contain exactly 10 digits.';
  if (form.pincode && !/^\d{6}$/.test(form.pincode)) errors.pincode = 'Pincode must contain exactly 6 digits.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  return errors;
};

const toFeatureAccessMap = (records) => {
  const accessMap = { ...defaultFeatureAccess };
  records.forEach((record) => {
    accessMap[record.feature] = {
      enabled: record.enabled,
      passwordSet: record.passwordSet,
      teacherId: record.teacherId,
      operation: record.operation || 'read',
      updatedAt: record.updatedAt,
    };
  });
  return accessMap;
};

const StatusBanner = ({ tone, text }) => (
  <div className={`mb-6 rounded-3xl border px-5 py-4 text-sm font-semibold ${
    tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
  }`}>
    {text}
  </div>
);

const PanelTitle = ({ icon: Icon, title, description }) => (
  <div className="flex items-center gap-3">
    <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
      <Icon size={20} />
    </div>
    <div>
      <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h2>
      <p className="text-sm font-semibold text-slate-500">{description}</p>
    </div>
  </div>
);

const TextInput = ({ label, error = '', ...props }) => (
  <div className="space-y-2">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
        error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
      }`}
      {...props}
    />
    {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
  </div>
);

const TextArea = ({ label, error = '', ...props }) => (
  <div className="space-y-2">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className={`min-h-28 w-full rounded-2xl border-2 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
        error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
      }`}
      {...props}
    />
    {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
  </div>
);

const SelectInput = ({ label, options, renderOptionLabel, error = '', ...props }) => (
  <div className="space-y-2">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
        error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
      }`}
      {...props}
    >
      {options.map((option) => <option key={option} value={option}>{renderOptionLabel ? renderOptionLabel(option) : option}</option>)}
    </select>
    {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
  </div>
);

const PasswordInput = ({ label, field, form, setForm, visiblePassword, setVisiblePassword, error }) => {
  const isVisible = visiblePassword === field;
  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
      <div className={`flex rounded-2xl border-2 bg-slate-50 focus-within:bg-white focus-within:ring-4 ${
        error ? 'border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-100' : 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-indigo-100'
      }`}>
        <input
          type={isVisible ? 'text' : 'password'}
          value={form[field]}
          onChange={(event) => setForm({ ...form, [field]: event.target.value })}
          className="min-w-0 flex-1 bg-transparent px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none"
        />
        <button
          type="button"
          onClick={() => setVisiblePassword(isVisible ? '' : field)}
          className="px-4 text-slate-400 transition hover:text-indigo-700"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
};

const Toggle = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-indigo-200 hover:bg-white"
  >
    <span className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">{label}</span>
    <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-5' : ''}`} />
    </span>
  </button>
);

const ActionRow = ({ children }) => (
  <div className="mt-8 flex justify-end">
    {children}
  </div>
);

const ActionButton = ({ icon: Icon, label, ...props }) => (
  <button
    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-indigo-600"
    {...props}
  >
    <Icon size={15} />
    {label}
  </button>
);

const ControlButton = ({ icon: Icon, title, description, onClick, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-3xl border p-5 text-left transition ${
      danger ? 'border-rose-200 bg-rose-50 hover:bg-white' : 'border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-white'
    }`}
  >
    <Icon size={22} className={danger ? 'text-rose-600' : 'text-indigo-700'} />
    <h3 className="mt-4 text-base font-black uppercase tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
  </button>
);

export default SettingsManagement;
