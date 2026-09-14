import { Plus } from 'lucide-react';
import { SectionHeading } from './LandingShared';
const questions = [
  ['What is VidyantraErp?', 'VidyantraErp is a cloud-based School & College ERP for academic, administrative and operational workflows, including students, staff, attendance, fees and campus services.'],
  ['Can multiple schools use VidyantraErp?', 'Yes. Each school or college has an institution-scoped workspace with separate users, records, settings and subscription access.'],
  ['Can we choose only the modules we need?', 'Available modules depend on your subscription and institution feature-access configuration. Contact us to discuss what your institution needs.'],
  ['Can our plan be upgraded later?', 'Yes. Plan changes are handled through platform subscription management. Contact support to discuss the plan, limits and timing of your change.'],
  ['Do Admin, Teacher and Student users have different access?', 'Yes. Role-based access gives each user a relevant workspace and permissions. Teachers may receive additional assigned module permissions.'],
  ['Does it support attendance and fee management?', 'Yes. Attendance supports class-based tracking and reporting. Fees supports fee structures, collections, dues, receipts and payment history.'],
  ['Are hostel, transport and library included?', 'These modules are available where enabled for your institution. Check your plan’s included features or ask us about your requirements.'],
  ['Is our institution’s data shared with other schools?', 'Institute records are logically separated and tenant-scoped. Users are restricted to their authorized institution and permitted workflows.'],
  ['How does the free trial work?', 'When registration is available, register your institute and verify your email. Your workspace receives the configured default trial. Trial duration and enabled modules depend on platform configuration.'],
  ['Can we request a demo?', 'Yes. Use the demo form below and tell us a little about your institution. Your request is saved for follow-up by the platform team.'],
];
export default function FAQSection() {
  return <section id="faq" className="landing-section"><div className="landing-container landing-faq-layout"><SectionHeading eyebrow="A FEW THINGS YOU MIGHT BE WONDERING" title="Frequently asked questions">Have a question about your institution’s setup? <a href="#contact" className="landing-text-link">Talk to our team.</a></SectionHeading><div className="landing-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={17} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>;
}
