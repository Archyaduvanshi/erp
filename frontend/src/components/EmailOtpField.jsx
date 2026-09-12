import { createPortal } from 'react-dom';
import React, { useEffect, useRef, useState } from 'react';
import { emailVerificationRequest, rememberEmailProof, emailVerifiedUntil, forgetEmailProof } from '../utils/emailVerification';

export default function EmailOtpField({ email, purpose, children, disabled = false }) {
  const [actionTarget, setActionTarget] = useState(null);
  const normalized = String(email || '').trim().toLowerCase();
  return <div>
    {children?.(disabled ? null : <span ref={setActionTarget} className="absolute right-2 top-1/2 -translate-y-1/2" />)}
    {!disabled && <OtpInput key={`${purpose}:${normalized}`} email={normalized} purpose={purpose} actionTarget={actionTarget} />}
  </div>;
}

function OtpInput({ email, purpose, actionTarget }) {
  const [challenge, setChallenge] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verifiedUntil, setVerifiedUntil] = useState(() => emailVerifiedUntil(email, purpose));
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  const verified = verifiedUntil > now;
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const send = async () => {
    setBusy(true); setError('');
    try {
      const result = await emailVerificationRequest('send', { email, purpose });
      if (!mounted.current) return;
      forgetEmailProof(email, purpose);
      setChallenge(result.challengeId); setOtp(''); setVerifiedUntil(0);
      setResendAt(Date.now() + result.resendAfter * 1000);
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError('');
    try {
      const result = await emailVerificationRequest('verify', { challengeId: challenge, otp });
      if (!mounted.current) return;
      rememberEmailProof(email, purpose, result.proof, result.expiresIn);
      setVerifiedUntil(Date.now() + result.expiresIn * 1000); setOtp('');
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  };

  return <div className="mt-2 space-y-2" aria-live="polite">
    {actionTarget && createPortal(<button type="button" disabled={verified || !validEmail || busy || wait > 0} onClick={send}
      className="whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{verified ? 'Verified' : busy ? 'Please wait...' : wait ? `Resend in ${wait}s` : challenge ? 'Resend OTP' : 'Send OTP'}</button>, actionTarget)}
    {verified ? <p className="text-sm font-bold text-emerald-700">✓ Email verified</p> : <>
      <div className="relative">
        <input aria-label="Email OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={otp} disabled={!challenge || busy} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (otp.length === 6 && !busy) verify(); } }}
          placeholder="Enter 6-digit email OTP"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-24 text-sm text-slate-900 outline-none focus:border-emerald-500" />
        <button type="button" disabled={!challenge || otp.length !== 6 || busy} onClick={verify}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Verify</button>
      </div>

      {challenge && <p className="text-xs text-slate-500">Code sent to {email}. Valid for 5 minutes; check spam too.</p>}
    </>}
    {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
  </div>;
}
