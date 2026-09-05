import React from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, Users, HeartHandshake, ArrowRight, BookOpen, Trophy, 
  ClipboardCheck, Wallet, Bus, Home, BarChart3, Clock, FileText, 
  Megaphone, Construction, ShieldCheck, BellRing, Landmark, 
  Globe, Shield, Zap, CheckCircle
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. SaaS NAVIGATION */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-3">
            <div className="bg-linear-to-br from-blue-700 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-100">
              <GraduationCap className="text-white" size={26} />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase italic text-slate-900">VidyantraErp <span className="text-blue-600 text-sm align-top">SaaS</span></span>
          </Link>
          
          <div className="hidden lg:flex gap-10 font-bold text-[10px] text-slate-400 uppercase tracking-[0.2em]">
            <a href="#features" className="hover:text-blue-600 transition-colors">Platform Features</a>
            <a href="#solutions" className="hover:text-blue-600 transition-colors">Institution Solutions</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">Admin Login</Link>
            <button className="bg-blue-600 text-white px-7 py-2.5 rounded-full font-bold text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
              <Link to="/register-institute">Register Institution </Link>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. SaaS HERO: MULTI-TENANT VISION */}
      <section className="relative px-6 pt-24 pb-32 max-w-7xl mx-auto text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,var(--color-blue-50)_0%,transparent_70%)] -z-10" />
        
        <div className="inline-flex items-center gap-3 px-5 py-2 mb-10 text-[10px] font-black tracking-[0.3em] text-blue-700 uppercase bg-blue-50 rounded-full border border-blue-100">
          The Operating System for Modern Colleges
        </div>
        
        <h1 className="text-6xl md:text-[5.5rem] font-black text-slate-950 leading-[0.9] mb-10 tracking-tighter">
          Empower Your Campus. <br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-500 bg-size-[200%_auto] animate-pulse">Scale Your Institution.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto mb-16 leading-relaxed font-medium">
          A secure multi-tenant SaaS platform where any college can register to manage **Student Life**, 
          **Staff Operations**, and **Financial Transparency** in one cloud-based environment.
        </p>

        {/* TRUST BADGES FOR THE SAAS MODEL */}
        <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
           <TrustBadge icon={Globe} label="Multi-Tenant Cloud" />
           <TrustBadge icon={Shield} label="Private Data Isolation" />
           <TrustBadge icon={Zap} label="Instant Activation" />
        </div>
      </section>

      {/* 3. THE BENTO CORE: ALL ERP MODULES  */}
      <section id="features" className="px-8 py-32 max-w-7xl mx-auto text-left">
        <div className="mb-20">
          <h2 className="text-4xl font-black text-slate-950 mb-4 tracking-tighter uppercase italic">Institutional Command Center</h2>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">A comprehensive suite covering all 15+ modules from your roadmap [cite: 1-71].</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[240px]">
          {/* Module 1 & 2: Admission & Registration [cite: 2, 8] */}
          <BentoItem 
            span="md:col-span-2 md:row-span-2"
            icon={ClipboardCheck}
            title="Admissions & Lifecycle"
            desc="Online admission forms , merit list generation , student registration , and professional ID generation."
            bg="bg-white border-blue-100"
            iconColor="text-blue-600"
          />

          {/* Module 3: Attendance [cite: 13] */}
          <BentoItem 
            icon={ShieldCheck}
            title="Attendance & Biometrics"
            desc="Subject-wise tracking [cite: 15] and biometric gate entry [cite: 18] with instant parent alerts[cite: 17]."
            iconColor="text-emerald-600"
          />

          {/* Module 4: Fee Management [cite: 19] */}
          <BentoItem 
            icon={Landmark}
            title="Financial Control"
            desc="Fee collection , online payments [cite: 22], and receipt generation  with due reports[cite: 24]."
            iconColor="text-amber-600"
          />

          {/* Module 5: Examination [cite: 25] */}
          <BentoItem 
            span="md:col-span-2"
            icon={BarChart3}
            title="Exams & Performance"
            desc="Schedules [cite: 26], result generation [cite: 28], and analytics for every student and teacher[cite: 63]."
            bg="bg-slate-950 text-white border-slate-800"
            iconColor="text-blue-400"
          />

          {/* Module 14 & 15: Expense & Finance [cite: 64, 70] */}
          <BentoItem 
            icon={Construction}
            title="Expense Logging"
           desc="Track Building [cite: 67], Worker [cite: 68], and Material expenses [cite: 69] for total transparency."
            iconColor="text-rose-500"
          />

          {/* Sports Management [cite: 89] */}
          <BentoItem 
            icon={Trophy}
            title="Sports Excellence"
            desc="Tournament management , team creation [cite: 96], and achievement/medal records."
            iconColor="text-orange-500"
          />
        </div>
      </section>

      {/* 4. DEDICATED ROLE PORTALS [cite: 72] */}
      <section id="solutions" className="px-8 py-32 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-16 tracking-tighter uppercase italic">Tailored Dashboards</h2>
          <div className="grid gap-8 md:grid-cols-2">
             <PortalEntry 
               icon={GraduationCap} 
               label="Student Portal" 
               items={["Registration [cite: 3][cite_start]", "Online Submission [cite: 80][cite_start]", "Result View [cite: 28]"]} 
               theme="blue"
             />
             <PortalEntry 
               icon={HeartHandshake} 
               label="Parent Portal [cite: 72]" 
               items={["Fee Status [cite: 75][cite_start]", "Attendance Check [cite: 74][cite_start]", "Notice Board [cite: 83]"]} 
               theme="emerald"
             />
          </div>
        </div>
      </section>

      {/* 5. LOGISTICS & NOTIFICATIONS */}
      <section className="px-8 py-32 max-w-7xl mx-auto text-left">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-12">
            <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-tight">Infrastructure & <br/> Digital Alerts</h2>
            <div className="space-y-8">
              <FeatureRow icon={Bus} title="Transport Control" desc="Manage bus routes and student transport records[cite: 48, 49]." />
              <FeatureRow icon={Home} title="Hostel Allocation" desc="Manage room allocation and hostel attendance[cite: 52, 54]." />
              <FeatureRow icon={BookOpen} title="Library Management" desc="Book management and automated late return fines[cite: 44, 46]." />
              <FeatureRow icon={Megaphone} title="Smart Communication" desc="SMS alerts [cite: 57], email notifications [cite: 56], and holiday news[cite: 87]." />
            </div>
          </div>
          <div className="bg-slate-50 p-12 rounded-4xl border border-slate-100">
             <h3 className="text-xl font-bold mb-8">Ready to onboard your college?</h3>
             <ul className="space-y-4 mb-10">
                <OnboardingStep step="1" text="Register your institution profile" />
                <OnboardingStep step="2" text="Setup fee structure and courses [cite: 20, 31]" />
                <OnboardingStep step="3" text="Onboard teachers and students" />
             </ul>
             <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                Launch My ERP <ArrowRight size={18}/>
             </button>
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="bg-slate-950 text-white pt-24 pb-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-16 mb-24 text-left">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-8">
              <GraduationCap className="text-blue-500" size={32} />
              <span className="text-2xl font-black italic tracking-tighter uppercase">VidyantraErp</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
              The professional SaaS platform for modern education. Complete data isolation for 
              your college, ensuring secure management of **Students**, **Staff**, and **Finance**.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-16 text-sm">
             <FooterCol title="Modules" links={["Admission", "Attendance", "Fees", "Examination"]} />
             <FooterCol title="Admin" links={["Teacher Mgt", "Transport", "Library", "Expenses"]} />
             <FooterCol title="Legal" links={["Privacy Policy", "SaaS Agreement", "Data Security"]} />
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
           <p>© 2026 VidyantraErp SaaS Platform</p>
           <div className="flex gap-8">
             <span>Terms</span>
             <span>Security</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

// --- SUB-COMPONENTS (FIXED FOR SYNTAX) ---

const BentoItem = ({ icon: Icon, title, desc, span = "", bg = "bg-white", iconColor = "" }) => (
  <div className={`${span} ${bg} p-10 rounded-4xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-xl hover:border-blue-200 transition-all text-left`}>
    <div>
      <div className={`mb-6 ${iconColor}`}><Icon size={40} /></div>
      <h4 className="text-xl font-black mb-3 tracking-tight">{title}</h4>
      <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-wider opacity-70">{desc}</p>
    </div>
  </div>
);

const PortalEntry = ({ icon: Icon, label, items, theme }) => {
  const themes = {
    blue: "border-blue-100 text-blue-600 bg-blue-50/30",
    indigo: "border-indigo-100 text-indigo-600 bg-indigo-50/30",
    emerald: "border-emerald-100 text-emerald-600 bg-emerald-50/30",
  };
  return (
    <div className={`p-10 rounded-4xl border transition-all hover:shadow-2xl text-left ${themes[theme]}`}>
       <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm border border-slate-100"><Icon size={28}/></div>
       <h3 className="text-2xl font-black text-slate-950 mb-6 tracking-tight">{label}</h3>
       <ul className="space-y-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
               <CheckCircle size={14} className="text-current opacity-50" /> {item}
            </li>
          ))}
       </ul>
    </div>
  );
};

const FeatureRow = ({ icon: Icon, title, desc }) => (
  <div className="flex gap-6 group text-left">
    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0 shadow-sm">
      <Icon size={24} />
    </div>
    <div>
      <h5 className="font-black text-slate-950 tracking-tight text-lg mb-1">{title}</h5>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">{desc}</p>
    </div>
  </div>
);

const TrustBadge = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
     <Icon size={18}/> {label}
  </div>
);

const OnboardingStep = ({ step, text }) => (
  <li className="flex items-center gap-4 text-sm font-bold text-slate-700">
     <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">{step}</span>
     {text}
  </li>
);

const FooterCol = ({ title, links }) => (
  <div>
    <h4 className="font-black text-white uppercase tracking-[0.2em] mb-8 text-[11px]">{title}</h4>
    <ul className="space-y-4">
      {links.map((link, i) => (
        <li key={i}><Link to="#" className="text-slate-500 hover:text-blue-400 transition-colors font-bold uppercase text-[10px] tracking-widest">{link}</Link></li>
      ))}
    </ul>
  </div>
);

const Badge = ({ label }) => (
  <span className="px-5 py-2 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-slate-200">
    {label}
  </span>
);

export default LandingPage;
