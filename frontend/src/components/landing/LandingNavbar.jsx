import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Brand, TrialLink } from './LandingShared';

const links = ['Features', 'Solutions', 'Security', 'Pricing', 'FAQ', 'Contact'];
export default function LandingNavbar() {
  const [active, setActive] = useState('');
  const dialog = useRef(null);
  const trigger = useRef(null);
  const savedOverflow = useRef('');
  const location = useLocation();
  const close = () => { dialog.current?.close(); trigger.current?.focus(); };
  const open = () => { savedOverflow.current = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.current.showModal(); };
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('a[href], button:not([disabled])')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  useEffect(() => {
    const menu = dialog.current;
    return () => { if (menu?.open) document.body.style.overflow = savedOverflow.current; };
  }, []);
  useEffect(() => { dialog.current?.close(); }, [location]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-15% 0px -65% 0px' });
    links.forEach(label => { const el = document.getElementById(label.toLowerCase()); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [location.pathname]);
  const navigation = links.map(label => <Link key={label} to={`/#${label.toLowerCase()}`} onClick={() => dialog.current?.close()} aria-current={active === label.toLowerCase() ? 'location' : undefined}>{label}</Link>);
  return <header className="landing-header"><div className="landing-container landing-nav"><Brand /><nav className="landing-desktop-nav" aria-label="Main navigation">{navigation}</nav><div className="landing-nav-actions"><Link className="landing-login" to="/login">Login</Link><TrialLink /><button ref={trigger} className="landing-menu-button" type="button" aria-label="Open navigation menu" aria-haspopup="dialog" onClick={open}><Menu /></button></div></div>
    <dialog ref={dialog} className="landing-drawer" aria-label="Navigation menu" onKeyDown={trapFocus} onClick={e => { if (e.target === dialog.current) close(); }} onClose={() => { document.body.style.overflow = savedOverflow.current; trigger.current?.focus(); }}><div className="landing-drawer-content"><div className="landing-drawer-heading"><Brand /><button type="button" className="landing-menu-button" onClick={close} aria-label="Close navigation menu"><X /></button></div><nav aria-label="Mobile navigation">{navigation}<Link to="/login">Login</Link><TrialLink /></nav></div></dialog>
  </header>;
}
