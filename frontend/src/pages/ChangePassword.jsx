import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, GraduationCap, Lock, ShieldCheck } from 'lucide-react';
import { authApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { emailVerificationRequest } from '../utils/emailVerification';

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
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [proof, setProof] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const needsOtp = session?.mustChangePassword && ['STUDENT', 'TEACHER'].includes(String(session?.role || '').toUpperCase());
  const resendWait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sendOtp = async () => {
    const result = await authApi.sendPasswordChangeOtp(formData);
    setChallenge(result); setOtp(''); setProof('');
    setResendAt(Date.now() + result.resendAfter * 1000);
  };

  const resendOtp = async () => {
    setIsSubmitting(true); setError('');
    try { await sendOtp(); }
    catch (apiError) { setError(apiError.message || 'Unable to send OTP.'); }
    finally { setIsSubmitting(false); }
  };

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
      if (needsOtp && !challenge) {
        await sendOtp();
        return;
      }
      let verifiedProof = proof;
      if (needsOtp && !verifiedProof) {
        if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit OTP sent to your registered email.'); return; }
        const result = await emailVerificationRequest('verify', { challengeId: challenge.challengeId, otp });
        verifiedProof = result.proof;
        setProof(verifiedProof);
      }
      await authApi.changePassword(formData, verifiedProof);
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
            disabled={isSubmitting || Boolean(challenge)}
            value={formData.currentPassword}
            visible={visibleField === 'currentPassword'}
            onToggle={() => setVisibleField((current) => current === 'currentPassword' ? null : 'currentPassword')}
            onChange={(event) => setFormData((current) => ({ ...current, currentPassword: event.target.value }))}
          />
          <PasswordInput
            label="New Password"
            disabled={isSubmitting || Boolean(challenge)}
            value={formData.newPassword}
            visible={visibleField === 'newPassword'}
            onToggle={() => setVisibleField((current) => current === 'newPassword' ? null : 'newPassword')}
            onChange={(event) => setFormData((current) => ({ ...current, newPassword: event.target.value }))}
          />
          <PasswordInput
            label="Confirm Password"
            disabled={isSubmitting || Boolean(challenge)}
            value={formData.confirmPassword}
            visible={visibleField === 'confirmPassword'}
            onToggle={() => setVisibleField((current) => current === 'confirmPassword' ? null : 'confirmPassword')}
            onChange={(event) => setFormData((current) => ({ ...current, confirmPassword: event.target.value }))}
          />
          {challenge && <div className="space-y-3" aria-live="polite">
            <p className="text-sm font-semibold text-slate-600">OTP sent to {challenge.maskedEmail}. Your password has not changed yet.</p>
            <div className="relative">
              <input aria-label="Email OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                disabled={isSubmitting || Boolean(proof)} placeholder="Enter 6-digit OTP"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-4 pr-24 text-sm font-bold outline-none focus:border-emerald-500" />
              <button type="submit" disabled={isSubmitting || (!proof && otp.length !== 6)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isSubmitting ? 'Saving...' : proof ? 'Save' : 'Verify'}</button>
            </div>
            <p className="text-xs text-slate-500">Verification will save your new password. OTP expires in 5 minutes.</p>
            <div className="flex justify-between gap-3">
              <button type="button" onClick={resendOtp} disabled={isSubmitting || resendWait > 0}
                className="text-xs font-bold text-emerald-700 disabled:opacity-50">{resendWait ? `Resend in ${resendWait}s` : 'Resend OTP'}</button>
              <button type="button" disabled={isSubmitting} onClick={() => { setChallenge(null); setOtp(''); setProof(''); setError(''); }}
                className="text-xs font-bold text-slate-500">Edit passwords</button>
            </div>
          </div>}
          {!challenge && <button
            type="submit"
            disabled={isSubmitting || isSuccess}
            className="w-full rounded-3xl bg-slate-950 py-5 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-100 transition hover:-translate-y-1 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-slate-950"
          >
            {isSubmitting ? (needsOtp ? 'Sending OTP...' : 'Updating...') : 'Update Password'}
          </button>}
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
        aria-label={label}
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
