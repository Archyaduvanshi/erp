import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { usePublicConfig } from '../../api/publicApi';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import '../../components/landing/landing.css';

const RegisterInstitute = lazy(() => import('../RegisterInstitute'));
export default function PublicRegistration() {
  const config = usePublicConfig();
  if (config.data?.registrationEnabled === true) return <Suspense fallback={<div className="landing landing-container landing-registration-status" role="status">Loading institute registration…</div>}><RegisterInstitute /></Suspense>;
  return <div className="landing"><LandingNavbar /><main className="landing-container landing-registration-status">{config.isPending ? <p role="status">Checking registration availability…</p> : <><h1>{config.isError ? 'Let’s help you get started.' : 'Let’s discuss your institution.'}</h1><p>{config.isError ? 'Registration availability could not be checked. Please retry or contact us.' : 'Online registration is currently paused. Request a demo to speak with the team.'}</p><Link to="/#contact" className="landing-button primary">Request Demo</Link>{config.isError && <button type="button" className="landing-button secondary" onClick={() => config.refetch()}>Retry</button>}</>}</main><LandingFooter /></div>;
}
