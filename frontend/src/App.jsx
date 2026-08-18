import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import './index.css';

import LandingPage from './components/LandingPage';
import RegisterInstitute from './pages/RegisterInstitute';
import Login from './pages/Login';
import { warmApi } from './utils/api';

const ComingSoonPage = lazy(() => import('./components/ComingSoonPage'));
const Dashboard = lazy(() => import('./pages/college/Dashboard'));
const StudentManagement = lazy(() => import('./pages/college/StudentManagement'));
const TeacherManagement = lazy(() => import('./pages/college/TeacherManagement'));
const TransportManagement = lazy(() => import('./pages/college/TransportManagement'));
const AttendanceManagement = lazy(() => import('./pages/college/AttendanceManagement'));
const CourseSubjectManagement = lazy(() => import('./pages/college/CourseSubjectManagement'));
const ExaminationManagement = lazy(() => import('./pages/college/ExaminationManagement'));
const ResultManagement = lazy(() => import('./pages/college/ResultManagement'));
const ReportsManagement = lazy(() => import('./pages/college/ReportsManagement'));
const LibraryManagement = lazy(() => import('./pages/college/LibraryManagement'));
const HostelManagement = lazy(() => import('./pages/college/HostelManagement'));
const FeeManagement = lazy(() => import('./pages/college/FeeManagement'));
const TimetableManagement = lazy(() => import('./pages/college/TimetableManagement'));
const SalaryManagement = lazy(() => import('./pages/college/SalaryManagement'));
const HolidayManagement = lazy(() => import('./pages/college/HolidayManagement'));
const NoticeManagement = lazy(() => import('./pages/college/NoticeManagement'));
const SettingsManagement = lazy(() => import('./pages/college/SettingsManagement'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentAttendance = lazy(() => import('./pages/student/StudentAttendance'));
const StudentExaminations = lazy(() => import('./pages/student/StudentExaminations'));
const StudentFees = lazy(() => import('./pages/student/StudentFees'));
const StudentHostel = lazy(() => import('./pages/student/StudentHostel'));
const StudentLibrary = lazy(() => import('./pages/student/StudentLibrary'));
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'));
const StudentTimetable = lazy(() => import('./pages/student/StudentTimetable'));
const StudentTransport = lazy(() => import('./pages/student/StudentTransport'));
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherAttendance = lazy(() => import('./pages/teacher/Attendance'));
const TeacherExaminations = lazy(() => import('./pages/teacher/Examinations'));
const TeacherMarks = lazy(() => import('./pages/teacher/Marks'));
const TeacherProfile = lazy(() => import('./pages/teacher/TeacherProfile'));
const TeacherSalary = lazy(() => import('./pages/teacher/TeacherSalary'));
const TeacherTimetable = lazy(() => import('./pages/teacher/Timetable'));
const PortalNotices = lazy(() => import('./pages/portal/PortalNotices'));

function App() {
  useEffect(() => {
    warmApi();
  }, []);

  return (
    <Router>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />  
          <Route path="/register-institute" element={<RegisterInstitute />} />
          <Route path="/login" element={<Login />} />
          
          {/* College Admin Dashboard */}
          <Route path="/college" element={<RequireCollegeAccess><Dashboard /></RequireCollegeAccess>} />
          <Route path="/college/students" element={<RequireCollegeAccess><StudentManagement /></RequireCollegeAccess>} />
          <Route path="/college/teachers" element={<RequireCollegeAccess><TeacherManagement /></RequireCollegeAccess>} />
          <Route path="/college/transport" element={<RequireCollegeAccess><TransportManagement /></RequireCollegeAccess>} />
          <Route path="/college/attendance" element={<RequireCollegeAccess><AttendanceManagement /></RequireCollegeAccess>} />
          <Route path="/college/courses" element={<RequireCollegeAccess><CourseSubjectManagement /></RequireCollegeAccess>} />
          <Route path="/college/examinations" element={<RequireCollegeAccess><ExaminationManagement /></RequireCollegeAccess>} />
          <Route path="/college/results" element={<RequireCollegeAccess><ResultManagement /></RequireCollegeAccess>} />
          <Route path="/college/library" element={<RequireCollegeAccess><LibraryManagement /></RequireCollegeAccess>} />
          <Route path="/college/hostel" element={<RequireCollegeAccess><HostelManagement /></RequireCollegeAccess>} />
          <Route path="/college/fees" element={<RequireCollegeAccess><FeeManagement /></RequireCollegeAccess>} />
          <Route path="/college/salary" element={<RequireCollegeAccess><SalaryManagement /></RequireCollegeAccess>} />
          <Route path="/college/salary/:teacherId" element={<RequireCollegeAccess><SalaryManagement /></RequireCollegeAccess>} />
          <Route path="/college/timetable" element={<RequireCollegeAccess><TimetableManagement /></RequireCollegeAccess>} />
          <Route path="/college/holidays" element={<RequireCollegeAccess><HolidayManagement /></RequireCollegeAccess>} />
          <Route path="/college/notices" element={<RequireCollegeAccess><NoticeManagement /></RequireCollegeAccess>} />
          <Route path="/college/reports" element={<RequireCollegeAccess><ReportsManagement /></RequireCollegeAccess>} />
          <Route path="/college/settings" element={<RequireCollegeAccess adminOnly><SettingsManagement /></RequireCollegeAccess>} />
          <Route path="/college/*" element={<ComingSoonPage />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/attendance" element={<StudentAttendance />} />
          <Route path="/student/examinations" element={<StudentExaminations />} />
          <Route path="/student/fees" element={<StudentFees />} />
          <Route path="/student/hostel" element={<StudentHostel />} />
          <Route path="/student/library" element={<StudentLibrary />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/timetable" element={<StudentTimetable />} />
          <Route path="/student/transport" element={<StudentTransport />} />
          <Route path="/student/notices" element={<PortalNotices role="student" />} />
          <Route path="/student/*" element={<ComingSoonPage />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/attendance" element={<TeacherAttendance />} />
          <Route path="/teacher/examinations" element={<TeacherExaminations />} />
          <Route path="/teacher/marks" element={<TeacherMarks />} />
          <Route path="/teacher/mark" element={<TeacherMarks />} />
          <Route path="/teacher/jmarks" element={<TeacherMarks />} />
          <Route path="/teacher/Marks" element={<TeacherMarks />} />
          <Route path="/teacher/profile" element={<TeacherProfile />} />
          <Route path="/teacher/salary" element={<TeacherSalary />} />
          <Route path="/teacher/timetable" element={<TeacherTimetable />} />
          <Route path="/teacher/notices" element={<PortalNotices role="teacher" />} />
          <Route path="/teacher/*" element={<ComingSoonPage />} />

          {/* Fallback for modules that are not wired yet */}
          <Route path="*" element={<ComingSoonPage backTo="/" backLabel="Back To Home" />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

const RouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
    <div>
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-slate-500">Loading</p>
    </div>
  </div>
);

const RequireCollegeAccess = ({ children, adminOnly = false }) => {
  const location = useLocation();
  const session = JSON.parse(localStorage.getItem('active_session') || 'null');

  if (!session) return <Navigate to="/login" replace />;
  if (session.role === 'admin') return children;
  if (adminOnly) return <Navigate to={session.allowedPath || '/login'} replace />;
  if (session.role === 'feature') {
    const allowedPath = session.allowedPath || '/login';
    return location.pathname.startsWith(allowedPath)
      ? <FeatureAccessFrame>{children}</FeatureAccessFrame>
      : <Navigate to={allowedPath} replace />;
  }

  return <Navigate to="/login" replace />;
};

const FeatureAccessFrame = ({ children }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('active_session');
    localStorage.removeItem('current_college_id');
    window.location.href = '/login';
  };

  return (
    <>
      <div className="fixed right-6 top-4 z-[100]">
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
      {isConfirmOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 px-6 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-4xl border border-slate-200 bg-white p-7 text-center shadow-2xl shadow-slate-950/20">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <LogOut size={24} />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">Confirm Logout</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              Are you sure you want to logout from this feature access?
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-rose-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
};

export default App;
