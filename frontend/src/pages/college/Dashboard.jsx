import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { instituteApi } from '../../utils/api';
import {
  Bell,
  Briefcase,
  BookOpen,
  Bus,
  CalendarDays,
  FileText,
  GraduationCap,
  Landmark,
  Library,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

const Dashboard = () => {
  const [collegeData, setCollegeData] = useState(() => getSessionInstitute());
  const navigate = useNavigate();

  useEffect(() => {
    const collegeId = localStorage.getItem('current_college_id');

    if (!collegeId) {
      navigate('/login');
      return;
    }

    let isMounted = true;

    const localInstitute = getLocalInstitute(collegeId);
    if (localInstitute) {
      setCollegeData(localInstitute);
    }

    const loadInstitute = async () => {
      try {
        const institute = await instituteApi.getById(collegeId);
        if (isMounted) {
          setCollegeData(institute);
          cacheInstitute(institute);
        }
      } catch (error) {
        if (isMounted && localInstitute) {
          setCollegeData(localInstitute);
          return;
        }

        const sessionInstitute = getSessionInstitute();
        if (isMounted && sessionInstitute) {
          setCollegeData(sessionInstitute);
          return;
        }

        localStorage.removeItem('current_college_id');
        localStorage.removeItem('active_session');
        navigate('/login');
      }
    };

    loadInstitute();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('current_college_id');
    localStorage.removeItem('active_session');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900">
      <header className="sticky top-0 z-50 h-20 border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-600 p-1.5 shadow-sm">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="hidden font-black uppercase italic tracking-tighter text-emerald-800 sm:block sm:text-xl">EduStream</span>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4 lg:gap-6 lg:pr-8">
              <button className="rounded-full bg-slate-50 p-2 text-slate-400 transition-all hover:text-blue-600">
                <Bell size={18} />
              </button>
              <div className="hidden text-right md:block">
                <p className="text-[10px] font-black uppercase text-slate-400">
                  {collegeData ? collegeData.instituteName : 'Admin User'}
                </p>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700">Active Session</span>
              </div>
              <button
                onClick={() => navigate('/college/settings')}
                className="rounded-lg bg-slate-50 p-2 text-slate-400 transition-all hover:text-blue-600"
                aria-label="Open settings"
              >
                <Settings size={18} />
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-100 transition-all hover:bg-rose-700 md:px-6 md:py-2.5 md:text-sm"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-6 pt-16 md:px-12 lg:px-20">
        <div className="mb-16 px-4 text-center">
          <h1 className="flex flex-wrap items-center justify-center gap-3 text-3xl font-black tracking-tighter text-slate-950 md:gap-4 md:text-5xl">
            <Landmark size={38} className="text-emerald-700" />
            {collegeData ? collegeData.instituteName : 'College'} Dashboard
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-3">
          <ModuleCard
            icon={<Users className="text-emerald-700" size={42} />}
            title="Student Management"
            desc="Manage student profiles, admissions, and academic history"
            onClick={() => navigate('/college/students')}
          />

          <ModuleCard
            icon={<Shield className="text-blue-700" size={42} />}
            title="Teacher Management"
            desc="Oversee faculty details, assignments, and performance"
            onClick={() => navigate('/college/teachers')}
          />

          <ModuleCard
            icon={<CalendarDays className="text-emerald-700" size={42} />}
            title="Attendance Management"
            desc="Track daily student attendance with date, status, and marked-by records"
            onClick={() => navigate('/college/attendance')}
          />

          <ModuleCard
            icon={<BookOpen className="text-amber-700" size={42} />}
            title="Course & Subject"
            desc="Define academic courses, subjects, and curriculum structure"
            onClick={() => navigate('/college/courses')}
          />

           <ModuleCard
            icon={<CalendarDays className="text-teal-700" size={42} />}
            title="Timetable Management"
            desc="Schedule class periods, teachers, rooms, substitutions, and exams"
            onClick={() => navigate('/college/timetable')}
          />

          <ModuleCard
            icon={<FileText className="text-indigo-700" size={42} />}
            title="Examination Management"
            desc="Schedule exams, manage results, and generate report cards"
            onClick={() => navigate('/college/examinations')}
          />

          <ModuleCard
            icon={<Library className="text-purple-700" size={42} />}
            title="Library Management"
            desc="Track book inventory, issues, returns, and late fines"
            onClick={() => navigate('/college/library')}
          />

          <ModuleCard
            icon={<Bus className="text-sky-700" size={42} />}
            title="Transport Management"
            desc="Manage drivers, buses, routes, and student transport assignments"
            onClick={() => navigate('/college/transport')}
          />

          <ModuleCard
            icon={<GraduationCap className="text-cyan-700" size={42} />}
            title="Hostel Management"
            desc="Allocate rooms, manage residents, and attendance"
            onClick={() => navigate('/college/hostel')}
          />

          <ModuleCard
            icon={<Landmark className="text-rose-700" size={42} />}
            title="Fees Management"
            desc="Track fee structures, collections, dues, and payment history"
            onClick={() => navigate('/college/fees')}
          />

          <ModuleCard
            icon={<Briefcase className="text-emerald-700" size={42} />}
            title="Salary Management"
            desc="Set teacher salary, revise compensation, and mark monthly salary payments"
            onClick={() => navigate('/college/salary')}
          />

          <ModuleCard
            icon={<Megaphone className="text-violet-700" size={42} />}
            title="Notice Management"
            desc="Create, schedule, pin, publish, and archive campus notices"
            onClick={() => navigate('/college/notices')}
          />

          <ModuleCard
            icon={<FileText className="text-fuchsia-700" size={42} />}
            title="Result"
            desc="Review published results, merit summaries, and student performance records"
            onClick={() => navigate('/college/examinations')}
          />

          <ModuleCard
            icon={<CalendarDays className="text-orange-700" size={42} />}
            title="Holiday"
            desc="Keep upcoming holidays, closures, and campus leave announcements in view"
            onClick={() => navigate('/college/holidays')}
          />

          <ModuleCard
            icon={<FileText className="text-slate-700" size={42} />}
            title="Reports"
            desc="View academic, financial, and institutional reports"
            onClick={() => navigate('/college/reports')}
          />

          <ModuleCard
            icon={<Settings className="text-slate-700" size={42} />}
            title="Settings"
            desc="Configure institutional profile and platform preferences"
            onClick={() => navigate('/college/settings')}
          />
        </div>
      </div>
    </div>
  );
};

const ModuleCard = ({ icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="group flex w-full flex-col items-center rounded-4xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-3 hover:scale-105 hover:shadow-2xl md:rounded-[2.5rem] md:p-12"
  >
    <div className="mb-6 transition-transform group-hover:scale-110 md:mb-8">
      {icon}
    </div>
    <h3 className="mb-2 text-xl font-bold tracking-tight text-slate-800 md:mb-3 md:text-2xl">{title}</h3>
    <p className="max-w-60 text-xs leading-relaxed text-slate-500 md:text-sm">{desc}</p>
  </button>
);

const getSessionInstitute = () => {
  try {
    const session = JSON.parse(localStorage.getItem('active_session') || 'null');
    return session?.instituteName
      ? {
          instituteName: session.instituteName,
          username: session.username,
          type: session.type,
          logo: session.logo,
        }
      : null;
  } catch {
    return null;
  }
};

const getLocalInstitute = (collegeId) => {
  try {
    const allColleges = JSON.parse(localStorage.getItem('registered_colleges') || '[]');
    return allColleges.find((college) => String(college.id) === String(collegeId)) || null;
  } catch {
    return null;
  }
};

const cacheInstitute = (institute) => {
  try {
    const allColleges = JSON.parse(localStorage.getItem('registered_colleges') || '[]');
    const nextColleges = allColleges.some((college) => String(college.id) === String(institute.id))
      ? allColleges.map((college) => String(college.id) === String(institute.id) ? { ...college, ...institute } : college)
      : [...allColleges, institute];

    localStorage.setItem('registered_colleges', JSON.stringify(nextColleges));
  } catch {
    // Cache is only a speed-up for deployed navigation; ignore localStorage quota/parse issues.
  }
};

export default Dashboard;
