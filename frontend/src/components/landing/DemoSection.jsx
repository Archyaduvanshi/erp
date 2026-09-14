import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { publicRequest } from '../../api/publicApi';
import { ContactLinks, SectionHeading } from './LandingShared';

export default function DemoSection() {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const result = useRef(null);
  const startedAt = useRef(Date.now());
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    setPending(true); setError(''); setFieldErrors({});
    const values = Object.fromEntries(new FormData(form));
    try {
      await publicRequest('demo-requests', { method: 'POST', body: JSON.stringify({ ...values, approximateStudents: Number(values.approximateStudents), startedAt: startedAt.current }) });
      setSuccess(true);
    } catch (failure) { setError(failure.message); setFieldErrors(failure.fieldErrors); }
    finally { setPending(false); requestAnimationFrame(() => result.current?.focus()); }
  }
  const field = (name, label, attributes = {}) => <label className="landing-field" key={name}><span>{label}{attributes.required ? ' *' : ' (optional)'}</span><input name={name} {...attributes} aria-invalid={!!fieldErrors[name]} aria-describedby={fieldErrors[name] ? `demo-${name}-error` : undefined} />{fieldErrors[name] && <span className="landing-field-error" id={`demo-${name}-error`}>{fieldErrors[name]}</span>}</label>;
  return <section id="contact" className="landing-section landing-white"><div className="landing-container landing-demo-layout"><div><SectionHeading eyebrow="LET’S TALK ABOUT YOUR INSTITUTION" title="See what a connected campus could look like.">Request a demo tailored to your academic, administrative and campus needs.</SectionHeading><div className="landing-demo-notes"><Mail size={24} aria-hidden="true" /><h3>A conversation, not a commitment.</h3><p>Tell us what you’re looking for. The team can walk you through relevant workflows, plans and setup.</p><ContactLinks /></div></div><div className="landing-demo-card"><h3>Request a Demo</h3><p className="landing-small-note">Fields marked * are required. Please do not include student records or passwords.</p>{success ? <div className="landing-demo-success" ref={result} tabIndex={-1} role="status"><CheckCircle2 size={36} /><h4>Your demo request is received.</h4><p>Thank you. The platform team can follow up using the contact details you provided.</p></div> : <form onSubmit={submit}><div className="landing-form-grid">{field('name', 'Your name', { required: true, maxLength: 100, autoComplete: 'name' })}{field('instituteName', 'Institute name', { required: true, maxLength: 160, autoComplete: 'organization' })}{field('email', 'Email', { required: true, type: 'email', maxLength: 254, autoComplete: 'email' })}{field('phone', 'Phone', { required: true, type: 'tel', maxLength: 24, pattern: '[+0-9() .\\-]{7,24}', autoComplete: 'tel', title: 'Enter 7–15 digits; spaces, +, brackets and dashes are allowed.' })}<label className="landing-field"><span>Institute type *</span><select name="instituteType" required defaultValue=""><option value="" disabled>Select type</option><option>School</option><option>College</option><option>Other</option></select></label>{field('city', 'City', { maxLength: 100, autoComplete: 'address-level2' })}{field('approximateStudents', 'Approximate students', { required: true, type: 'number', min: 1, max: 1000000, step: 1 })}</div><label className="landing-field"><span>What would you like to see? (optional)</span><textarea name="message" rows={3} maxLength={2000} /></label><div className="landing-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div><p className="landing-small-note">We use these details to respond to your request. Read our <Link to="/privacy">Privacy Policy</Link>.</p>{error && <div className="landing-form-error" ref={result} tabIndex={-1} role="alert">{error}</div>}<button type="submit" disabled={pending} className="landing-button primary">{pending ? 'Sending request…' : 'Request Demo'}<ArrowRight size={17} aria-hidden="true" /></button></form>}</div></div></section>;
}
