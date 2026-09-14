import { ArrowUpRight, Check, Users, ClipboardCheck, Wallet, CalendarDays, BookOpen, BarChart3, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardPreview() {
  return <div className="landing-dashboard" aria-label="Illustrative ERP dashboard with sample data">
    <div className="preview-toolbar"><span><GraduationCap size={19} /> VidyantraErp</span><span className="preview-demo-badge">SAMPLE WORKSPACE</span></div>
    <div className="preview-content"><div className="preview-greeting"><div><span className="landing-eyebrow">YOUR INSTITUTION, CONNECTED</span><p>College Dashboard</p></div><span className="preview-session">Academic session</span></div>
      <div className="preview-stats">{[[Users, 'Students', '240', 'Enrolled'], [ClipboardCheck, 'Attendance', '92%', 'Today'], [Wallet, 'Fees collected', '₹1.8L', 'This month']].map(([Icon, label, value, note]) => <div key={label}><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div>
      <div className="preview-modules">{[[Users, 'Students', 'emerald'], [ClipboardCheck, 'Attendance', 'blue'], [Wallet, 'Fees', 'amber'], [CalendarDays, 'Timetable', 'teal'], [BookOpen, 'Library', 'indigo'], [BarChart3, 'Reports', 'rose']].map(([Icon, name, color]) => <div key={name}><span className={`landing-icon ${color}`}><Icon size={21} /></span><span>{name}</span></div>)}</div>
      <div className="preview-bottom"><span><span className="preview-dot" /> One workspace. Connected departments.</span><Check size={16} /></div>
    </div>
  </div>;
}

export default function HeroSection() {
  return <section className="landing-container landing-hero"><div className="landing-hero-copy"><p className="landing-eyebrow"><span className="eyebrow-line" /> BUILT AROUND YOUR INSTITUTION</p><h1>Smart School &amp; College Management,<br /><span>All in One Place.</span></h1><p className="landing-hero-description">Less paperwork. More time for education. Bring students, staff, attendance, fees, examinations and everyday operations together in one connected ERP.</p><div className="landing-cta-row"><a className="landing-button secondary" href="#contact">Request Demo <ArrowUpRight size={17} /></a></div><p className="landing-hero-note">Built for schools, colleges and growing educational institutions.</p><Link to="/login" className="landing-text-link">Already using VidyantraErp? Login <ArrowUpRight size={15} /></Link></div><div className="landing-hero-visual"><DashboardPreview /><p className="preview-caption">Product workflow preview · Illustrative data only</p></div></section>;
}
