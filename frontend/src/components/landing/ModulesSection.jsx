import { Users, GraduationCap, BookOpen, ClipboardCheck, CalendarDays, FileText, Award, Sun, Wallet, Banknote, Landmark, BarChart3, Library, BedDouble, Bus, Megaphone, QrCode, Building2, ShieldCheck, SlidersHorizontal, Settings } from 'lucide-react';
import { SectionHeading } from './LandingShared';

const groups = [
  { name: 'Academic management', description: 'From the first admission to the final result.', color: 'blue', items: [
    [Users, 'Student Management', 'Organize admissions, profiles, documents and academic records.'],
    [GraduationCap, 'Teacher Management', 'Manage faculty profiles, assignments and access.'],
    [BookOpen, 'Classes & Subjects', 'Bring classes, sections and subjects into one structure.'],
    [ClipboardCheck, 'Attendance', 'Mark attendance and review patterns across classes.'],
    [CalendarDays, 'Timetable', 'Coordinate periods, teachers, rooms and substitutions.'],
    [FileText, 'Examination', 'Organize schedules, admit cards and exam workflows.'],
    [Award, 'Results', 'Manage marks and publish student results securely.'],
    [Sun, 'Holidays', 'Keep institution calendars and holiday schedules aligned.'],
  ] },
  { name: 'Finance & reporting', description: 'A clearer view of collections and commitments.', color: 'emerald', items: [
    [Wallet, 'Fees Management', 'Track structures, collections, dues and receipts.'],
    [Banknote, 'Salary Management', 'Manage staff salary profiles, payroll and payments.'],
    [Landmark, 'Cashbook & Finance', 'Keep income, expenses and account records organized.'],
    [BarChart3, 'Reports', 'Turn academic, financial and operational records into insights.'],
  ] },
  { name: 'Campus operations', description: 'Connected services beyond the classroom.', color: 'amber', items: [
    [Library, 'Library', 'Track books, issues, returns and borrower activity.'],
    [BedDouble, 'Hostel', 'Manage rooms, residents and hostel operations.'],
    [Bus, 'Transport', 'Organize vehicles, routes, stops and allocations.'],
    [Megaphone, 'Notices', 'Share announcements with the right classes and users.'],
    [QrCode, 'QR Identification', 'Identify students and teachers within permitted ERP workflows.'],
  ] },
  { name: 'Platform management', description: 'The right setup for every institution.', color: 'indigo', items: [
    [Building2, 'Multi-Institute Management', 'Keep each institution’s users, settings and records separate.'],
    [ShieldCheck, 'Role-Based Access', 'Give each user access appropriate to their role.'],
    [SlidersHorizontal, 'Subscriptions & Features', 'Configure plan limits and available modules per institution.'],
    [Settings, 'Platform Administration', 'Centralize institute, subscription and feature management.'],
  ] },
];

export default function ModulesSection() {
  return <section id="features" className="landing-section landing-white"><div className="landing-container"><SectionHeading eyebrow="ONE ERP. EVERY DEPARTMENT." title="Everything your school or college needs">Choose connected modules that fit the way your institution works.</SectionHeading><div className="landing-module-groups">{groups.map(group => <div className="landing-module-group" key={group.name}><div className="module-group-heading"><h3>{group.name}</h3><p>{group.description}</p></div><div className="landing-module-grid">{group.items.map(([Icon, title, description]) => <article className="landing-module-card" key={title}><span className={`landing-icon ${group.color}`}><Icon size={21} aria-hidden="true" /></span><h4>{title}</h4><p>{description}</p></article>)}</div></div>)}</div></div></section>;
}
