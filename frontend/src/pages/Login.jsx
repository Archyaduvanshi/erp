import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, User, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { instituteApi, settingsApi, studentApi, teacherApi } from '../utils/api';
import { activateDemoSession, demoCredentials, getSchoolDemoSummary, seedDemoData } from '../utils/demoData';

const schoolDemoSummary = getSchoolDemoSummary();
const FEATURE_ROLES = [
  { value: 'admissionStudent', label: 'Admission Student', route: '/college/students' },
  { value: 'teacherFeature', label: 'Teacher Management', route: '/college/teachers', accessKey: 'teacher' },
  { value: 'library', label: 'Library', route: '/college/library' },
  { value: 'hostel', label: 'Hostel', route: '/college/hostel' },
  { value: 'fees', label: 'Fees', route: '/college/fees' },
  { value: 'transport', label: 'Transport', route: '/college/transport' },
  { value: 'attendance', label: 'Attendance', route: '/college/attendance' },
  { value: 'courses', label: 'Course & Subject', route: '/college/courses' },
  { value: 'examinations', label: 'Examination', route: '/college/examinations' },
  { value: 'timetable', label: 'Timetable', route: '/college/timetable' },
  { value: 'salary', label: 'Salary', route: '/college/salary' },
  { value: 'notices', label: 'Notice', route: '/college/notices' },
  { value: 'holidays', label: 'Holiday', route: '/college/holidays' },
];

const defaultRoleOptions = [
  { value: '', label: 'Select' },
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  ...FEATURE_ROLES,
];

const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loginRole, setLoginRole] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleLoadDemo = () => {
    seedDemoData();
    const demoInstitution = activateDemoSession('sunrise_demo');
    setError('');
    setFieldErrors({});

    if (demoInstitution) {
      navigate('/college');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setError('');
    setFieldErrors({});

    if (!loginRole) {
      setError('Please select a role.');
      setFieldErrors({ role: 'Please select a role.' });
      return;
    }

    setIsLoggingIn(true);

    if (loginRole === 'admin') {
      try {
        const user = await instituteApi.login({
          username: formData.username,
          password: formData.password,
        });

        localStorage.setItem('active_session', JSON.stringify({
          username: user.username,
          instituteName: user.instituteName,
          type: user.type,
          role: 'admin',
          logo: user.logo,
        }));
        localStorage.setItem('current_college_id', String(user.id));
        navigate('/college');
        return;
      } catch (apiError) {
        setIsLoggingIn(false);
        setError(apiError.message);
        setFieldErrors(apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0
          ? apiError.fieldErrors
          : { username: apiError.message, password: apiError.message });
        return;
      }
    }

    const credential = formData.username.trim();

    const featureRole = FEATURE_ROLES.find((role) => role.value === loginRole);
    if (featureRole) {
      try {
        const featureUser = await settingsApi.featureLogin({
          username: credential,
          feature: featureRole.accessKey || featureRole.value,
          password: formData.password,
        });

        localStorage.setItem('active_session', JSON.stringify({
          username: featureUser.username,
          instituteName: featureUser.instituteName,
          type: featureUser.type,
          role: 'feature',
          featureRole: featureUser.featureRole,
          featureLabel: featureRole.label,
          allowedPath: featureRole.route,
          logo: featureUser.logo,
        }));
        localStorage.setItem('current_college_id', String(featureUser.id));
        navigate(featureRole.route);
        return;
      } catch (apiError) {
        setIsLoggingIn(false);
        setError(apiError.message);
        setFieldErrors(apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0
          ? apiError.fieldErrors
          : { username: apiError.message, password: apiError.message });
        return;
      }
    }

    if (loginRole === 'teacher') {
      try {
        const teacher = await teacherApi.login({
          identifier: credential,
          password: formData.password,
        });

        localStorage.setItem('active_session', JSON.stringify({
          username: teacher.instituteUsername,
          instituteName: teacher.instituteName,
          type: teacher.instituteType,
          role: 'teacher',
          teacherId: teacher.teacherId,
          teacherSystemId: teacher.teacherSystemId,
          teacherName: teacher.teacherName,
          logo: teacher.instituteLogo,
        }));
        localStorage.setItem('current_college_id', String(teacher.instituteId));
        navigate('/teacher');
        return;
      } catch (apiError) {
        setIsLoggingIn(false);
        setError(apiError.message);
        setFieldErrors(apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0
          ? apiError.fieldErrors
          : { username: apiError.message, password: apiError.message });
        return;
      }
    }

    try {
      const student = await studentApi.login({
        identifier: credential,
        password: formData.password,
      });

      localStorage.setItem('active_session', JSON.stringify({
        username: student.instituteUsername,
        instituteName: student.instituteName,
        type: student.instituteType,
        role: 'student',
        studentId: student.studentId,
        studentSystemId: student.studentSystemId,
        enrollmentNo: student.enrollmentNo,
        studentName: student.studentName,
        logo: student.instituteLogo,
      }));
      localStorage.setItem('current_college_id', String(student.instituteId));
      navigate('/student');
      return;
    } catch (apiError) {
      setIsLoggingIn(false);
      setError(apiError.message);
      setFieldErrors(apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0
        ? apiError.fieldErrors
        : { username: apiError.message, password: apiError.message });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFF] flex flex-col lg:flex-row font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      
      {/* LEFT SIDE: SaaS BRANDING */}
      <div className="lg:w-1/3 bg-slate-950 p-12 lg:p-20 text-white flex flex-col justify-between relative overflow-hidden lg:sticky lg:top-0 lg:h-screen text-left">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,var(--color-blue-900)_0%,transparent_60%)] opacity-40" />
        
        <Link to="/" className="flex items-center gap-3 relative z-10 group">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform">
            <GraduationCap className="text-white" size={26} />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase italic">EduStream</span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-black mb-6 leading-tight tracking-tighter">
            Welcome Back to <br/> 
            <span className="text-blue-500 font-serif italic text-5xl">EduStream.</span>
          </h2>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest leading-relaxed">
            Access your secure institutional environment to manage **Students**, **Staff**, 
            and **Financial Records** with real-time analytics.
          </p>
        </div>

        <p className="text-slate-500 mt-3 text-[10px] font-black uppercase tracking-[0.3em] relative z-10">
          © 2026 EduStream SaaS Platform
        </p>
      </div>

      {/* RIGHT SIDE: LOGIN FORM */}
      <div className="lg:flex-1 p-8 lg:p-20 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white shadow-2xl shadow-slate-200/50 rounded-4xl border border-slate-100 p-8 md:p-12">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black text-slate-950 mb-2 tracking-tighter uppercase italic">
              {loginRole ? resolveRoleLabel(loginRole) : 'User'} Login
            </h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              {loginRole === 'admin'
                ? 'Enter institution credentials'
                : loginRole === 'teacher'
                  ? 'Use teacher ID or phone with the password given by the college'
                  : loginRole === 'student'
                    ? 'Use student ID, enrollment number, or phone with the portal password'
                    : featureRoleDescription(loginRole)}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-8">
            <InputGroup 
              label={loginRole === 'admin' || FEATURE_ROLES.some((role) => role.value === loginRole) ? 'Institution Username' : loginRole === 'teacher' ? 'Teacher ID Or Phone' : 'Student ID, Enrollment No, Or Phone'}
              icon={User} 
              placeholder={loginRole === 'admin' || FEATURE_ROLES.some((role) => role.value === loginRole) ? 'Enter institution username' : loginRole === 'teacher' ? 'Enter teacher ID or phone' : 'Enter student ID, enrollment no, or phone'} 
              value={formData.username}
              onChange={(e) => {
                setFormData({...formData, username: e.target.value});
                setFieldErrors((current) => ({ ...current, username: '' }));
              }}
              error={fieldErrors.username}
              required 
            />

            <RoleSelect
              value={loginRole}
              onChange={(value) => {
                setLoginRole(value);
                setError('');
                setFieldErrors({});
              }}
              options={defaultRoleOptions}
              error={fieldErrors.role}
            />
            
            <div className="space-y-2">
              <InputGroup 
                label="Password" 
                icon={Lock} 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••" 
                value={formData.password}
                onChange={(e) => {
                  setFormData({...formData, password: e.target.value});
                  setFieldErrors((current) => ({ ...current, password: '' }));
                }}
                error={fieldErrors.password}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-50"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                required 
              />
              <div className="text-right">
                <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">
                  Recovery Access?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-slate-950 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-blue-600 hover:-translate-y-1 transition-all shadow-2xl shadow-blue-100 active:scale-95 flex items-center justify-center gap-3 group disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-slate-950"
            >
              {isLoggingIn ? 'Logging in...' : loginRole === 'admin'
                ? 'Enter Dashboard'
                : loginRole === 'teacher'
                  ? 'Enter Teacher Portal'
                  : loginRole === 'student'
                    ? 'Enter Student Portal'
                    : `Enter ${resolveRoleLabel(loginRole)}`}
              <ArrowRight size={18} className={`transition-transform ${isLoggingIn ? '' : 'group-hover:translate-x-1'}`} />
            </button>
          </form>

          <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50/60 p-5 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">Demo Workspace</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
              Load realistic sample data for students, teachers, transport, and attendance. The school workspace now includes LKG to Class 12 with {schoolDemoSummary.totalSections} sections, {schoolDemoSummary.totalStudents} students, and {schoolDemoSummary.totalTeachers} teachers.
            </p>
            <button
              type="button"
              onClick={handleLoadDemo}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-blue-700"
            >
              Load School Demo Data And Login
            </button>
            <div className="mt-4 space-y-2">
              {demoCredentials.map((demo) => (
                <div key={demo.username} className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-black text-slate-900">{demo.instituteName}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {demo.type} | {demo.username} | {demo.password}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Need a new Workspace?</p>
            <Link to="/register-institute" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 hover:text-blue-600 transition-all">
              <ShieldCheck size={16} className="text-blue-600" />
              Register Your College
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const resolveRoleLabel = (value) => defaultRoleOptions.find((option) => option.value === value)?.label || 'User';
const featureRoleDescription = (value) => (
  FEATURE_ROLES.some((role) => role.value === value)
    ? 'Use institution username with the selected feature password'
    : 'Select role to continue'
);

const RoleSelect = ({ value, onChange, options, error }) => (
  <div className="space-y-2 text-left">
    <label className={`text-[10px] font-black uppercase tracking-widest ${error ? 'text-rose-500' : 'text-slate-400'}`}>Select Role</label>
    <div className="relative">
      <ShieldCheck className={`absolute left-5 top-1/2 -translate-y-1/2 ${error ? 'text-rose-400' : 'text-slate-300'}`} size={18} />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full appearance-none rounded-2xl border bg-slate-50 py-4 pl-12 pr-5 text-sm font-bold text-slate-900 outline-none transition-all ${
          error
            ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-50'
            : 'border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
    {error && <p className="text-[11px] font-bold leading-5 text-rose-600">{error}</p>}
  </div>
);

const InputGroup = ({ label, icon: Icon, type = "text", error, rightElement, ...props }) => (
  <div className="space-y-2 text-left">
    <label className={`text-[10px] font-black uppercase tracking-widest ${error ? 'text-rose-500' : 'text-slate-400'}`}>{label}</label>
    <div className="relative group">
      <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-400' : 'text-slate-300 group-focus-within:text-blue-600'}`}>
        <Icon size={18} />
      </div>
      <input 
        type={type}
        className={`w-full bg-slate-50 border rounded-2xl pl-12 ${rightElement ? 'pr-14' : 'pr-5'} py-4 font-bold text-sm outline-none transition-all placeholder:text-slate-200 ${
          error
            ? 'border-rose-300 text-rose-700 focus:border-rose-500 focus:ring-4 focus:ring-rose-50'
            : 'border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
        }`}
        {...props}
      />
      {rightElement}
    </div>
    {error && <p className="text-[11px] font-bold leading-5 text-rose-600">{error}</p>}
  </div>
);

export default Login;
