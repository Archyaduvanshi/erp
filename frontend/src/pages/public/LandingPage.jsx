import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LandingNavbar from '../../components/landing/LandingNavbar';
import HeroSection from '../../components/landing/HeroSection';
import LandingFooter from '../../components/landing/LandingFooter';
import ModulesSection from '../../components/landing/ModulesSection';
import PricingSection from '../../components/landing/PricingSection';
import ProductPreviewSection from '../../components/landing/ProductPreviewSection';
import FAQSection from '../../components/landing/FAQSection';
import DemoSection from '../../components/landing/DemoSection';
import { TrustStrip, ProblemSolutionSection, HowItWorksSection, RoleSection, MultiTenantSection, SecuritySection, PerformanceSection, ReportingSection, WhySection, FinalCTA } from '../../components/landing/ValueSections';
import '../../components/landing/landing.css';

export default function LandingPage() {
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash]);
  return <div className="landing"><a className="landing-skip" href="#main">Skip to content</a><LandingNavbar /><main id="main"><HeroSection /><TrustStrip /><ProblemSolutionSection /><ModulesSection /><HowItWorksSection /><RoleSection /><MultiTenantSection /><SecuritySection /><PerformanceSection /><PricingSection /><ProductPreviewSection /><ReportingSection /><WhySection /><FAQSection /><DemoSection /><FinalCTA /></main><LandingFooter /></div>;
}
