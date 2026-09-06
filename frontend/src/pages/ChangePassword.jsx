import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, GraduationCap, Lock, ShieldCheck } from 'lucide-react';
import { authApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol.';

const ChangePassword = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [visibleField, setVisibleField] = useState(null);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!PASSWORD_PATTERN.test(formData.newPassword)) {
      setError(PASSWORD_MESSAGE);
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authApi.changePassword(formData);
      setIsSuccess(true);
      await logout().catch(() => null);
      navigate('/login', { replace: true });
    } catch (apiError) {
      setError(apiError.message || 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFBFF] px-6 py-12 text-slate-900">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/60">
        <div className="mb-10 inline-flex items-center gap-3 text-slate-950">
          <span className="rounded-2xl bg-blue-600 p-2 text-white"><GraduationCap size={24} /></span>
          <span className="text-xl font-black uppercase italic tracking-tight">VidyantraErp</span>
        </div>
        <div className="mb-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-950">Change Password</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {session?.username ? `${session.username} must set a new password before continuing.` : 'Set a new password before continuing.'}
          </p>
        </div>

        {error && <StatusPanel tone="error" icon={AlertCircle} text={error} />}
        {isSuccess && <StatusPanel tone="success" icon={CheckCircle2} text="Password updated. Please login with the new password." />}

        <form onSubmit={handleSubmit} className="space-y-6">
          <PasswordInput
            label="Current Password"
            value={formData.currentPassword}
            visible={visibleField === 'currentPassword'}
            onToggle={() => setVisibleField((current) => current === 'currentPassword' ? null : 'currentPassword')}
            onChange={(event) => setFormData((current) => ({ ...current, currentPassword: event.target.value }))}
          />
          <PasswordInput
            label="New Password"
            value={formData.newPassword}
            visible={visibleField === 'newPassword'}
            onToggle={() => setVisibleField((current) => current === 'newPassword' ? null : 'newPassword')}
            onChange={(event) => setFormData((current) => ({ ...current, newPassword: event.target.value }))}
          />
          <PasswordInput
            label="Confirm Password"
            value={formData.confirmPassword}
            visible={visibleField === 'confirmPassword'}
            onToggle={() => setVisibleField((current) => current === 'confirmPassword' ? null : 'confirmPassword')}
            onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))}
          />
          <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            className="w-full rounded-3xl bg-slate-950 py-5 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-100 transition hover:-translate-y-1 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-slate-950"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

const PasswordInput = ({ label, visible, onToggle, ...props }) => (
  <div className="space-y-2 text-left">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
    <div className="relative">
      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
      <input
        type={visible ? 'text' : 'password'}
        className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-14 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
        required
        {...props}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);

const StatusPanel = ({ tone, icon: Icon, text }) => {
  const styles = tone === 'success'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
    : 'border-rose-100 bg-rose-50 text-rose-700';
  return (
    <div className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${styles}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p>{text}</p>
    </div>
  );
};

export default ChangePassword;
