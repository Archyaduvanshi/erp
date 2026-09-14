import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import { ContactLinks } from '../../components/landing/LandingShared';
import '../../components/landing/landing.css';

export default function LegalPage({ title, introduction, sections }) {
  return <div className="landing"><a className="landing-skip" href="#main">Skip to content</a><LandingNavbar /><main id="main" className="landing-container landing-legal"><p className="landing-eyebrow">VIDYANTRAERP · SERVICE INFORMATION</p><h1>{title}</h1><p>{introduction}</p>{sections.map(([heading, content]) => <section key={heading}><h2>{heading}</h2><p>{content}</p></section>)}<section><h2>Contact and support</h2><p>Use the published support details below or the contact form for questions about this service, your information, or your institution’s subscription. Students and staff should contact their institution first for corrections to institutional records.</p><ContactLinks /></section></main><LandingFooter /></div>;
}
