import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { usePublicConfig } from '../../api/publicApi';

export function Brand() {
  return <Link className="landing-brand" to="/" aria-label="VidyantraErp home"><span className="landing-logo"><GraduationCap size={25} aria-hidden="true" /></span><span>Vidyantra<span className="brand-accent">Erp</span><small>SCHOOL & COLLEGE ERP</small></span></Link>;
}

export function TrialLink({ className = '', children }) {
  const { data } = usePublicConfig();
  const enabled = data?.registrationEnabled === true;
  return <Link to={enabled ? '/register' : '/#contact'} className={`landing-button primary ${className}`}>{enabled ? children || 'Start Free Trial' : 'Request Demo'}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

export function SectionHeading({ eyebrow, title, children }) {
  return <div className="landing-section-heading"><p className="landing-eyebrow">{eyebrow}</p><h2>{title}</h2>{children && <p>{children}</p>}</div>;
}

export function ContactLinks() {
  const { data } = usePublicConfig();
  return <>{data?.supportEmail && <a href={`mailto:${data.supportEmail}`}>{data.supportEmail}</a>}{data?.supportPhone && <a href={`tel:${data.supportPhone.replace(/[^+\d]/g, '')}`}>{data.supportPhone}</a>}<Link to="/#contact">Request a demo or contact support</Link></>;
}
