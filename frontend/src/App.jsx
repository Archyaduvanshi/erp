import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './index.css';

import LandingPage from './components/LandingPage';
import ComingSoonPage from './components/ComingSoonPage';
import RegisterInstitute from './pages/RegisterInstitute';
import Dashboard from './pages/college/Dashboard';
import Login from './pages/Login';
import StudentManagement from './pages/college/StudentManagement';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentExaminations from './pages/student/StudentExaminations';
import StudentFees from './pages/student/StudentFees';
import StudentHostel from './pages/student/StudentHostel';
import StudentLibrary from './pages/student/StudentLibrary';
import StudentProfile from './pages/student/StudentProfile';
import StudentTimetable from './pages/student/StudentTimetable';
import StudentTransport from './pages/student/StudentTransport';
import HostelManagement from './pages/college/HostelManagement';
import TeacherManagement from './pages/college/TeacherManagement';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherExaminations from './pages/teacher/Examinations';
import TeacherMarks from './pages/teacher/Marks';
import TeacherProfile from './pages/teacher/TeacherProfile';
import TeacherSalary from './pages/teacher/TeacherSalary';
import TeacherTimetable from './pages/teacher/Timetable';
import TransportManagement from './pages/college/TransportManagement';
import AttendanceManagement from './pages/college/AttendanceManagement';
import CourseSubjectManagement from './pages/college/CourseSubjectManagement';
import ExaminationManagement from './pages/college/ExaminationManagement';
import LibraryManagement from './pages/college/LibraryManagement';
import FeeManagement from './pages/college/FeeManagement';
import TimetableManagement from './pages/college/TimetableManagement';
import SalaryManagement from './pages/college/SalaryManagement';
import HolidayManagement from './pages/college/HolidayManagement';
import NoticeManagement from './pages/college/NoticeManagement';
import PortalNotices from './pages/portal/PortalNotices';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />  
        <Route path="/register-institute" element={<RegisterInstitute />} />
        <Route path="/login" element={<Login />} />
        
        {/* College Admin Dashboard */}
        <Route path="/college" element={<Dashboard />} />
        <Route path="/college/students" element={<StudentManagement />} />
        <Route path="/college/teachers" element={<TeacherManagement />} />
        <Route path="/college/transport" element={<TransportManagement />} />
        <Route path="/college/attendance" element={<AttendanceManagement />} />
        <Route path="/college/courses" element={<CourseSubjectManagement />} />
        <Route path="/college/examinations" element={<ExaminationManagement />} />
        <Route path="/college/library" element={<LibraryManagement />} />
        <Route path="/college/hostel" element={<HostelManagement />} />
        <Route path="/college/fees" element={<FeeManagement />} />
        <Route path="/college/salary" element={<SalaryManagement />} />
        <Route path="/college/salary/:teacherId" element={<SalaryManagement />} />
        <Route path="/college/timetable" element={<TimetableManagement />} />
        <Route path="/college/holidays" element={<HolidayManagement />} />
        <Route path="/college/notices" element={<NoticeManagement />} />
        <Route path="/college/reports" element={<ComingSoonPage />} />
        <Route path="/college/settings" element={<ComingSoonPage />} />
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
    </Router>
  );
}

export default App;
