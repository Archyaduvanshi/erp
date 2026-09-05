import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, GraduationCap, Lock, ShieldCheck, User } from 'lucide-react';
import { authApi } from '../utils/api';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({ institutionCode: '', username: '' });
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResponse(null);
    setIsSubmitting(true);
    try {
      const result = await authApi.forgotPassword({
        institutionCode: formData.institutionCode.trim(),
        username: formData.username.trim(),
      });
      setResponse(result);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Recover Access" subtitle="Request a secure reset link for your account">
      {error && <StatusPanel tone="error" icon={AlertCircle} text={error} />}
      {response && (
        <StatusPanel
          tone="success"
          icon={CheckCircle2}
          text={response.message || 'If the account exists, a reset link has been sent.'}
          detail={response.resetToken ? `Dev reset token: ${response.resetToken}` : ''}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <InputGroup
          label="Institution Code"
          icon={ShieldCheck}
          placeholder="VICTOR"
          value={formData.institutionCode}
          onChange={(event) => setFormData((current) => ({
            ...current,
            institutionCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20),
          }))}
          required
        />
        <InputGroup
          label="Username / Enrollment ID / Teacher ID"
          icon={User}
          placeholder="EMP0001 or STU0001"
          value={formData.username}
          onChange={(event) => setFormData((current) => ({ ...current, username: event.target.value }))}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-3xl bg-slate-950 py-5 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-100 transition hover:-translate-y-1 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-slate-950"
        >
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <BackToLogin />
    </AuthShell>
  );
};

const AuthShell = ({ title, subtitle, children }) => (
  <div className="flex min-h-screen items-center justify-center bg-[#FAFBFF] px-6 py-12 text-slate-900">
    <div className="w-full max-w-lg rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/60">
      <Link to="/" className="mb-10 inline-flex items-center gap-3 text-slate-950">
        <span className="rounded-2xl bg-blue-600 p-2 text-white"><GraduationCap size={24} /></span>
        <span className="text-xl font-black uppercase italic tracking-tight">VidyantraErp</span>
      </Link>
      <div className="mb-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Lock size={24} />
        </div>
        <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  </div>
);

const InputGroup = ({ label, icon: Icon, ...props }) => (
  <div className="space-y-2 text-left">
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
    <div className="relative">
      <Icon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
      <input
        className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
        {...props}
      />
    </div>
  </div>
);

const StatusPanel = ({ tone, icon: Icon, text, detail }) => {
  const styles = tone === 'success'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
    : 'border-rose-100 bg-rose-50 text-rose-700';
  return (
    <div className={`mb-6 rounded-2xl border p-4 text-sm font-bold ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0" />
        <div>
          <p>{text}</p>
          {detail && <p className="mt-3 break-all rounded-xl bg-white/70 p-3 text-xs">{detail}</p>}
        </div>
      </div>
    </div>
  );
};

const BackToLogin = () => (
  <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 transition hover:text-blue-800">
    <ArrowLeft size={16} />
    Back To Login
  </Link>
);

export default ForgotPassword;
