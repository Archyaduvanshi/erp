import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Route,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { academicSessionApi, transportApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import QRScannerButton from '../../components/scanner/QRScannerButton';

const initialDriverForm = {
  driverName: '',
  driverPhone: '',
  driverLicense: '',
  salary: '',
  busNumber: '',
  routeName: '',
  vehicleType: '',
  seatCapacity: '',
  pickupPoints: '',
};

const initialStudentForm = {
  enrollmentNo: '',
  className: '',
  section: '',
  studentId: '',
  studentName: '',
  fatherName: '',
  pickupStop: '',
  pickupStopId: '',
  assignedDriverId: '',
  routeId: '',
};

const LICENSE_FORMAT_HINT = 'Use format SS-YY-XXXXXXXXXX, like DL-01-1234567890.';
const BUS_NUMBER_FORMAT_HINT = 'Use format SS NN AA NNNN, like UP 16 AB 1234.';
const PHONE_FORMAT_HINT = 'Mobile number must contain exactly 10 digits.';

const DRIVER_REQUIRED_FIELDS = {
  driverName: 'Driver Name',
  driverPhone: 'Driver Phone',
  driverLicense: 'License Number',
  salary: 'Salary',
  busNumber: 'Bus Number',
  routeName: 'Route Name',
  vehicleType: 'Vehicle Type',
  seatCapacity: 'Seat Capacity',
  pickupPoints: 'Bus Start Point',
};

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
const normalizeLicenseNumber = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const normalizeBusNumber = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ');

const isValidDrivingLicense = (value) => /^[A-Z]{2}[\s-]?\d{2}[\s-]?\d{10}$/.test(String(value || '').trim().toUpperCase());
const isValidBusNumber = (value) => /^[A-Z]{2}[\s-]?\d{2}[\s-]?[A-Z]{2}[\s-]?\d{4}$/.test(String(value || '').trim().toUpperCase());

const formatDriverFieldValue = (field, value) => {
  if (field === 'driverPhone') return onlyDigits(value).slice(0, 10);
  if (field === 'driverLicense') return normalizeLicenseNumber(value);
  if (field === 'busNumber') return normalizeBusNumber(value);
  if (['driverName', 'routeName', 'pickupPoints'].includes(field)) return String(value || '').toUpperCase();
  return value;
};

const getDriverFieldError = (field, value) => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) {
    return `Please fill ${DRIVER_REQUIRED_FIELDS[field]}.`;
  }
  if (field === 'driverPhone' && onlyDigits(trimmedValue).length !== 10) return PHONE_FORMAT_HINT;
  if (field === 'driverLicense' && !isValidDrivingLicense(trimmedValue)) return LICENSE_FORMAT_HINT;
  if (field === 'busNumber' && !isValidBusNumber(trimmedValue)) return BUS_NUMBER_FORMAT_HINT;
  if (['salary', 'seatCapacity'].includes(field) && Number(trimmedValue) <= 0) {
    return `${DRIVER_REQUIRED_FIELDS[field]} must be greater than 0.`;
  }
  return '';
};

const validateDriverForm = (form) => Object.keys(DRIVER_REQUIRED_FIELDS).reduce((errors, field) => {
  const error = getDriverFieldError(field, form[field]);
  return error ? { ...errors, [field]: error } : errors;
}, {});

const normalizeDriverPayload = (form) => ({
  ...form,
  driverName: form.driverName.trim(),
  driverPhone: onlyDigits(form.driverPhone),
  driverLicense: form.driverLicense.trim().toUpperCase(),
  salary: form.salary.trim(),
  busNumber: form.busNumber.trim().toUpperCase(),
  routeName: form.routeName.trim(),
  vehicleType: form.vehicleType.trim(),
  seatCapacity: form.seatCapacity.trim(),
  pickupPoints: form.pickupPoints.trim(),
});

const TransportManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const instituteId = session?.id || '';
  const [activeSection, setActiveSection] = useState('home');
  const [driverSearch, setDriverSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [driverForm, setDriverForm] = useState(initialDriverForm);
  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [selectedStudentDriverId, setSelectedStudentDriverId] = useState('');
  const [isStudentTransportFormOpen, setIsStudentTransportFormOpen] = useState(false);
  const [attendanceDriverId, setAttendanceDriverId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loadError, setLoadError] = useState('');
  const [driverFormErrors, setDriverFormErrors] = useState({});

  const selectedMonth = useMemo(() => String(attendanceDate || '').slice(0, 7), [attendanceDate]);

  const sessionsQuery = useQuery({
    queryKey: ['transport-academic-sessions', instituteId],
    queryFn: academicSessionApi.getAll,
    enabled: Boolean(instituteId),
    staleTime: 10 * 60 * 1000,
  });

  const academicSession = useMemo(() => {
    const sessions = sessionsQuery.data || [];
    return sessions.find((item) => item.current) || sessions[0] || null;
  }, [sessionsQuery.data]);
  const academicSessionId = academicSession?.id || null;

  const overviewQuery = useQuery({
    queryKey: ['transport-overview', instituteId, attendanceDate],
    queryFn: () => transportApi.getOverview(attendanceDate),
    enabled: activeSection === 'home' && Boolean(instituteId && attendanceDate),
    staleTime: 60 * 1000,
  });

  const driversQuery = useQuery({
    queryKey: ['transport-drivers', instituteId],
    queryFn: transportApi.getDrivers,
    enabled: activeSection !== 'home' && Boolean(instituteId),
    staleTime: 5 * 60 * 1000,
  });

  const routeOperationsQuery = useQuery({
    queryKey: ['transport-route-operations', instituteId, academicSessionId, attendanceDate],
    queryFn: () => transportApi.getRouteOperations({ academicSessionId, date: attendanceDate }),
    enabled: activeSection !== 'home' && Boolean(instituteId && academicSessionId),
    staleTime: 60 * 1000,
  });

  const assignmentsQuery = useQuery({
    queryKey: ['transport-assignments', instituteId, academicSessionId],
    queryFn: () => transportApi.getAssignments(academicSessionId),
    enabled: activeSection === 'students' && !selectedStudentDriverId && Boolean(instituteId && academicSessionId),
    staleTime: 2 * 60 * 1000,
  });

  const selectedDriverAssignmentsQuery = useQuery({
    queryKey: ['transport-driver-assignments', instituteId, academicSessionId, selectedStudentDriverId || attendanceDriverId || null],
    queryFn: () => transportApi.getRouteAssignments(selectedStudentDriverId || attendanceDriverId, academicSessionId),
    enabled: activeSection !== 'home' && Boolean(instituteId && academicSessionId && (selectedStudentDriverId || attendanceDriverId)),
    staleTime: 60 * 1000,
  });

  const dailyAttendanceQuery = useQuery({
    queryKey: ['transport-attendance-day', instituteId, attendanceDriverId || null, attendanceDate],
    queryFn: () => transportApi.getRouteDailyAttendance({ routeId: attendanceDriverId, date: attendanceDate }),
    enabled: activeSection === 'attendance' && Boolean(instituteId && attendanceDriverId && attendanceDate),
  });

  const monthlyAttendanceQuery = useQuery({
    queryKey: ['transport-attendance-month', instituteId, attendanceDriverId || null, selectedMonth],
    queryFn: () => transportApi.getRouteMonthlyAttendance({ routeId: attendanceDriverId, month: selectedMonth }),
    enabled: activeSection === 'attendance' && Boolean(instituteId && attendanceDriverId && selectedMonth),
  });

  const drivers = driversQuery.data || [];
  const transportRoutes = routeOperationsQuery.data || [];
  const transportStudents = selectedStudentDriverId || attendanceDriverId
    ? selectedDriverAssignmentsQuery.data || []
    : assignmentsQuery.data || [];
  const students = studentForm.studentId ? [{
    id: Number(studentForm.studentId),
    enrollmentNo: studentForm.enrollmentNo,
    firstName: studentForm.studentName,
    guardianName: studentForm.fatherName,
    className: studentForm.className,
    section: studentForm.section,
  }] : [];
  const attendanceRecords = [
    ...(dailyAttendanceQuery.data || []),
    ...(monthlyAttendanceQuery.data || []),
  ].filter((record, index, records) => (
    records.findIndex((candidate) => String(candidate.id) === String(record.id)) === index
  ));

  const firstQueryError = [
    overviewQuery.error,
    sessionsQuery.error,
    driversQuery.error,
    routeOperationsQuery.error,
    assignmentsQuery.error,
    selectedDriverAssignmentsQuery.error,
    dailyAttendanceQuery.error,
    monthlyAttendanceQuery.error,
  ].find(Boolean);

  useEffect(() => {
    setLoadError(firstQueryError?.message || '');
  }, [firstQueryError]);

  useEffect(() => {
    const records = dailyAttendanceQuery.data || [];
    setAttendanceMap(records.reduce((map, record) => ({
      ...map,
      [String(record.studentId)]: record.status,
    }), {}));
  }, [dailyAttendanceQuery.data]);

  const filteredDrivers = useMemo(() => {
    const query = driverSearch.trim().toLowerCase();
    return drivers.filter((driver) => {
      if (!query) return true;
      return (
        driver.driverName?.toLowerCase().includes(query) ||
        driver.busNumber?.toLowerCase().includes(query) ||
        driver.routeName?.toLowerCase().includes(query) ||
        driver.driverPhone?.toLowerCase().includes(query) ||
        String(driver.salary || '').includes(query)
      );
    });
  }, [driverSearch, drivers]);

  const filteredTransportStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return transportStudents.filter((record) => {
      if (!query) return true;
      return (
        record.studentName?.toLowerCase().includes(query) ||
        record.className?.toLowerCase().includes(query) ||
        record.driverName?.toLowerCase().includes(query) ||
        record.busNumber?.toLowerCase().includes(query) ||
        record.routeName?.toLowerCase().includes(query)
      );
    });
  }, [studentSearch, transportStudents]);

  const attendanceDriver = transportRoutes.find((route) => String(route.routeId) === String(attendanceDriverId)) || null;
  const classOptions = useMemo(() => (
    [...new Set(students.map((student) => student.className).filter(Boolean))].sort((left, right) => left.localeCompare(right))
  ), [students]);
  const sectionOptions = useMemo(() => (
    [...new Set(
      students
        .filter((student) => !studentForm.className || student.className === studentForm.className)
        .map((student) => student.section)
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right))
  ), [studentForm.className, students]);
  const filteredStudentOptions = useMemo(() => (
    students.filter((student) => {
      if (!studentForm.className || !studentForm.section) {
        return false;
      }
      return student.className === studentForm.className && student.section === studentForm.section;
    })
  ), [studentForm.className, studentForm.section, students]);

  const studentsUnderSelectedDriver = useMemo(() => (
    transportStudents.filter((record) => String(record.routeId || '') === String(attendanceDriverId || ''))
  ), [attendanceDriverId, transportStudents]);

  const filteredAttendanceRecords = useMemo(() => (
    attendanceRecords
      .filter((record) => !attendanceDriverId || String(record.routeId) === String(attendanceDriverId))
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
  ), [attendanceDriverId, attendanceRecords]);

  const todayAttendance = attendanceRecords.filter((record) => record.date === attendanceDate);
  const todayPresentCount = todayAttendance.filter((record) => record.status === 'Present').length;
  const todayAbsentCount = todayAttendance.filter((record) => record.status === 'Absent').length;
  const assignedStudentsCount = transportStudents.filter((record) => record.assignedDriverId).length;
  const overview = overviewQuery.data || {};

  const monthlyAttendanceRegister = useMemo(() => {
    if (!attendanceDriverId) return null;

    const driverRecords = filteredAttendanceRecords
      .filter((record) => !Number.isNaN(new Date(`${record.date || ''}T00:00:00`).getTime()))
      .sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());

    const requestedMonthDate = new Date(`${attendanceDate}T00:00:00`);
    const fallbackRecordDate = driverRecords.length ? new Date(`${driverRecords[driverRecords.length - 1].date}T00:00:00`) : null;
    const selectedMonthDate = !Number.isNaN(requestedMonthDate.getTime())
      ? requestedMonthDate
      : fallbackRecordDate;
    if (!selectedMonthDate || Number.isNaN(selectedMonthDate.getTime())) return null;

    let selectedYear = selectedMonthDate.getFullYear();
    let selectedMonth = selectedMonthDate.getMonth();

    let recordsForMonth = driverRecords.filter((record) => {
      const recordDate = new Date(`${record.date || ''}T00:00:00`);
      return recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth;
    });

    if (!recordsForMonth.length && fallbackRecordDate) {
      selectedYear = fallbackRecordDate.getFullYear();
      selectedMonth = fallbackRecordDate.getMonth();
      recordsForMonth = driverRecords.filter((record) => {
        const recordDate = new Date(`${record.date || ''}T00:00:00`);
        return recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth;
      });
    }

    const currentDate = new Date();
    const isCurrentMonth = currentDate.getFullYear() === selectedYear && currentDate.getMonth() === selectedMonth;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const visibleDayCount = isCurrentMonth ? currentDate.getDate() : daysInMonth;
    const dayColumns = Array.from({ length: visibleDayCount }, (_, index) => index + 1);

    const dailyStatusMap = new Map();
    recordsForMonth.forEach((record) => {
      const recordDate = new Date(`${record.date}T00:00:00`);
      const dayNumber = recordDate.getDate();
      const studentKey = String(record.studentId || '');
      if (!studentKey || dayNumber > visibleDayCount) return;
      dailyStatusMap.set(`${studentKey}-${dayNumber}`, record.status === 'Present' ? 'P' : 'A');
    });

    const savedStudentsMap = new Map();
    recordsForMonth.forEach((record) => {
      const studentKey = String(record.studentId || record.studentName || '');
      if (!studentKey || savedStudentsMap.has(studentKey)) return;
      savedStudentsMap.set(studentKey, {
        id: record.studentId || studentKey,
        name: record.studentName || 'Unnamed student',
        className: record.className || '-',
      });
    });

    studentsUnderSelectedDriver.forEach((student) => {
      const studentKey = String(student.studentId || '');
      if (!studentKey || savedStudentsMap.has(studentKey)) return;
      savedStudentsMap.set(studentKey, {
        id: student.studentId,
        name: student.studentName || 'Unnamed student',
        className: student.className || '-',
      });
    });

    const query = recordSearch.trim().toLowerCase();
    const rows = [...savedStudentsMap.values()]
      .filter((student) => {
        if (!query) return true;
        return String(student.name || '').toLowerCase().includes(query)
          || String(student.className || '').toLowerCase().includes(query);
      })
      .map((student) => ({
        id: student.id,
        name: student.name,
        className: student.className,
        days: dayColumns.map((dayNumber) => dailyStatusMap.get(`${student.id}-${dayNumber}`) || ''),
      }));

    return {
      driverName: attendanceDriver?.driverName || 'Driver',
      routeName: attendanceDriver?.routeName || 'Route pending',
      busNumber: attendanceDriver?.busNumber || 'Bus pending',
      monthLabel: new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      dayColumns,
      rows,
    };
  }, [attendanceDate, attendanceDriver?.busNumber, attendanceDriver?.driverName, attendanceDriver?.routeName, attendanceDriverId, filteredAttendanceRecords, recordSearch, studentsUnderSelectedDriver]);

  const createDriverMutation = useMutation({
    mutationFn: transportApi.createDriver,
    onSuccess: (savedDriver) => {
      queryClient.setQueryData(['transport-drivers', instituteId], (current = []) => [savedDriver, ...current]);
      queryClient.invalidateQueries({ queryKey: ['transport-route-operations', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['transport-overview', instituteId] });
      setDriverForm(initialDriverForm);
      setDriverFormErrors({});
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to save the driver record.'),
  });

  const saveAssignmentMutation = useMutation({
    mutationFn: transportApi.saveAssignment,
    onSuccess: (savedAssignment) => {
      const routeKey = savedAssignment.routeId ? String(savedAssignment.routeId) : '';
      queryClient.setQueryData(['transport-driver-assignments', instituteId, academicSessionId, routeKey], (current = []) => {
        const withoutSaved = current.filter((record) => String(record.id) !== String(savedAssignment.id));
        return [savedAssignment, ...withoutSaved];
      });
      queryClient.invalidateQueries({ queryKey: ['transport-assignments', instituteId, academicSessionId] });
      queryClient.invalidateQueries({ queryKey: ['transport-route-operations', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['transport-overview', instituteId] });
      setStudentForm(initialStudentForm);
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to save the student transport record.'),
  });

  const deleteDriverMutation = useMutation({
    mutationFn: transportApi.deleteDriver,
    onSuccess: (_, driverId) => {
      queryClient.setQueryData(['transport-drivers', instituteId], (current = []) => current.filter((driver) => String(driver.id) !== String(driverId)));
      queryClient.invalidateQueries({ queryKey: ['transport-assignments', instituteId, academicSessionId] });
      queryClient.invalidateQueries({ queryKey: ['transport-route-operations', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['transport-overview', instituteId] });
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to delete the driver record.'),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: transportApi.deleteAssignment,
    onSuccess: (_, assignmentId) => {
      queryClient.setQueriesData({ queryKey: ['transport-driver-assignments', instituteId, academicSessionId] }, (current = []) => (
        Array.isArray(current) ? current.filter((record) => String(record.id) !== String(assignmentId)) : current
      ));
      queryClient.invalidateQueries({ queryKey: ['transport-assignments', instituteId, academicSessionId] });
      queryClient.invalidateQueries({ queryKey: ['transport-route-operations', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['transport-overview', instituteId] });
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to delete the student assignment.'),
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: transportApi.saveAttendance,
    onSuccess: (savedRecords) => {
      queryClient.setQueryData(['transport-attendance-day', instituteId, attendanceDriverId, attendanceDate], savedRecords);
      queryClient.invalidateQueries({ queryKey: ['transport-attendance-month', instituteId, attendanceDriverId, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['transport-route-operations', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['transport-overview', instituteId] });
      setAttendanceMap({});
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to save transport attendance.'),
  });

  const lookupStudentMutation = useMutation({
    mutationFn: ({ enrollmentNo }) => transportApi.lookupStudent(enrollmentNo),
    onSuccess: (student, variables) => {
      setStudentForm((current) => ({
        ...current,
        ...(variables.extraFormValues || {}),
        enrollmentNo: student.enrollmentNo || current.enrollmentNo,
        studentId: student.studentId ? String(student.studentId) : '',
        studentName: student.studentName || '',
        fatherName: student.fatherName || '',
        className: student.className || '',
        section: student.section || '',
      }));
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Student enrollment ID nahi mila.'),
  });

  const isSaving = [
    createDriverMutation.isPending,
    saveAssignmentMutation.isPending,
    deleteDriverMutation.isPending,
    deleteAssignmentMutation.isPending,
    saveAttendanceMutation.isPending,
    lookupStudentMutation.isPending,
  ].some(Boolean);

  const handleDriverSave = async (e) => {
    e.preventDefault();
    const normalizedDriverForm = normalizeDriverPayload(driverForm);
    const nextDriverErrors = validateDriverForm(normalizedDriverForm);
    setDriverFormErrors(nextDriverErrors);
    if (Object.keys(nextDriverErrors).length > 0) {
      setLoadError('Please fix the invalid driver fields before saving.');
      return;
    }

    createDriverMutation.mutate({
      ...normalizedDriverForm,
      status: 'Active',
      routeCode: `ROUTE-${normalizedDriverForm.routeName.replace(/\s+/g, '-').toUpperCase()}`,
    });
  };

  const handleStudentSave = async (e) => {
    e.preventDefault();
    saveAssignmentMutation.mutate({
      studentId: Number(studentForm.studentId),
      academicSessionId,
      assignedDriverId: studentForm.assignedDriverId ? Number(studentForm.assignedDriverId) : null,
      routeId: studentForm.routeId ? Number(studentForm.routeId) : null,
      pickupStopId: studentForm.pickupStopId ? Number(studentForm.pickupStopId) : null,
      pickupStop: studentForm.pickupStop,
    });
  };

  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm('Delete this driver and bus record?')) return;
    deleteDriverMutation.mutate(driverId);
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Delete this student transport assignment?')) return;
    deleteAssignmentMutation.mutate(assignmentId);
  };

  const handleAttendanceStatusChange = (studentId, status) => {
    setAttendanceMap((current) => ({
      ...current,
      [studentId]: status,
    }));
  };

  const handleAttendanceSave = async (e) => {
    e.preventDefault();
    if (!attendanceDriverId || studentsUnderSelectedDriver.length === 0) return;

    const unmarkedStudents = studentsUnderSelectedDriver.filter((record) => !attendanceMap[String(record.studentId)]);
    if (unmarkedStudents.length > 0) return;

    saveAttendanceMutation.mutate({
      driverId: Number(attendanceDriver?.driverId || 0),
      routeId: Number(attendanceDriverId),
      academicSessionId,
      date: attendanceDate,
      markedBy: attendanceDriver?.driverName || 'Driver',
      entries: studentsUnderSelectedDriver.map((record) => ({
        studentId: Number(record.studentId),
        status: attendanceMap[String(record.studentId)] || 'Absent',
      })),
    });
  };

  const handleTransportBack = () => {
    if (activeSection === 'students' && selectedStudentDriverId) {
      setSelectedStudentDriverId('');
      setIsStudentTransportFormOpen(false);
      setStudentForm(initialStudentForm);
      setStudentSearch('');
      return;
    }
    if (activeSection === 'students' && isStudentTransportFormOpen) {
      setIsStudentTransportFormOpen(false);
      setStudentForm(initialStudentForm);
      return;
    }
    if (activeSection !== 'home') {
      setActiveSection('home');
      return;
    }
    navigate('/college');
  };

  const handleScannedStudent = (identity) => {
    setActiveSection('students');
    setStudentSearch(identity.referenceNumber || identity.name || '');
    setStudentForm((current) => ({
      ...current,
      enrollmentNo: identity.referenceNumber || '',
      studentId: String(identity.id),
      studentName: identity.name || '',
      className: identity.className || '',
      section: identity.section || '',
    }));
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_45%,#f8fafc_100%)] text-slate-900 selection:bg-sky-400 selection:text-slate-950">
      <div className="border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={handleTransportBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-600">Transport Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Driver, Route, And Attendance Desk</h1>
            </div>
          </div>

          <QRScannerButton feature="transport" onResolved={handleScannedStudent} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        {activeSection === 'home' && (
          <TransportHome
            activeDrivers={overview.activeDrivers || 0}
            assignedStudentsCount={overview.assignedStudents || assignedStudentsCount}
            todayPresentCount={overview.todayPresent || todayPresentCount}
            todayAbsentCount={overview.todayAbsent || todayAbsentCount}
            onOpenDrivers={() => setActiveSection('drivers')}
            onOpenStudents={() => {
              setSelectedStudentDriverId('');
              setIsStudentTransportFormOpen(false);
              setStudentForm(initialStudentForm);
              setStudentSearch('');
              setActiveSection('students');
            }}
            onOpenAttendance={() => setActiveSection('attendance')}
          />
        )}

        {activeSection === 'drivers' && (
          <DriverSection
            driverForm={driverForm}
            setDriverForm={setDriverForm}
            driverFormErrors={driverFormErrors}
            setDriverFormErrors={setDriverFormErrors}
            filteredDrivers={filteredDrivers}
            onSearch={setDriverSearch}
            searchValue={driverSearch}
            onSave={handleDriverSave}
            isSaving={isSaving}
            onDelete={handleDeleteDriver}
          />
        )}

        {activeSection === 'students' && (
          <StudentSection
            studentForm={studentForm}
            setStudentForm={setStudentForm}
            students={students}
            classOptions={classOptions}
            sectionOptions={sectionOptions}
            filteredStudentOptions={filteredStudentOptions}
            drivers={transportRoutes}
            transportStudents={transportStudents}
            filteredTransportStudents={filteredTransportStudents}
            selectedDriverId={selectedStudentDriverId}
            setSelectedDriverId={setSelectedStudentDriverId}
            isStudentFormOpen={isStudentTransportFormOpen}
            setIsStudentFormOpen={setIsStudentTransportFormOpen}
            onSearch={setStudentSearch}
            searchValue={studentSearch}
            onSave={handleStudentSave}
            onLookupStudent={(enrollmentNo, extraFormValues = {}) => lookupStudentMutation.mutate({ enrollmentNo, extraFormValues })}
            isSaving={isSaving}
            onDelete={handleDeleteAssignment}
          />
        )}

        {activeSection === 'attendance' && (
          <AttendanceSection
            drivers={transportRoutes}
            attendanceDriverId={attendanceDriverId}
            setAttendanceDriverId={setAttendanceDriverId}
            attendanceDate={attendanceDate}
            setAttendanceDate={setAttendanceDate}
            studentsUnderSelectedDriver={studentsUnderSelectedDriver}
            attendanceMap={attendanceMap}
            onStatusChange={handleAttendanceStatusChange}
            onSave={handleAttendanceSave}
            isSaving={isSaving}
            recordSearch={recordSearch}
            setRecordSearch={setRecordSearch}
            monthlyAttendanceRegister={monthlyAttendanceRegister}
          />
        )}
      </div>
    </div>
  );
};

const TransportHome = ({
  activeDrivers,
  assignedStudentsCount,
  todayPresentCount,
  todayAbsentCount,
  onOpenDrivers,
  onOpenStudents,
  onOpenAttendance,
}) => (
  <div className="space-y-8">
    <section className="grid gap-6 lg:grid-cols-3">
      <EntryCard
        icon={Users}
        title="Driver Management"
        description="Save driver, salary, bus, route, phone, license, and the bus start point directly in the backend."
        meta={`${activeDrivers} active drivers`}
        buttonLabel="Open Drivers"
        onClick={onOpenDrivers}
      />
      <EntryCard
        icon={Bus}
        title="Student Transport"
        description="Assign each student to a saved driver and keep the student's transport facility status in sync."
        meta={`${assignedStudentsCount} student assignments`}
        buttonLabel="Open Students"
        onClick={onOpenStudents}
      />
      <EntryCard
        icon={ClipboardCheck}
        title="Transport Attendance"
        description="Let the driver route list act as an attendance card and mark whether a student came to school through transport or not."
        meta={`${todayPresentCount + todayAbsentCount} daily records`}
        buttonLabel="Open Attendance"
        onClick={onOpenAttendance}
      />
    </section>
  </div>
);

const DriverSection = ({ driverForm, setDriverForm, driverFormErrors, setDriverFormErrors, filteredDrivers, onSearch, searchValue, onSave, isSaving, onDelete }) => {
  const updateDriverField = (field, rawValue) => {
    const value = formatDriverFieldValue(field, rawValue);
    setDriverForm({ ...driverForm, [field]: value });
    setDriverFormErrors({
      ...driverFormErrors,
      [field]: getDriverFieldError(field, value),
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Driver Section"
        title="Drivers, buses, and routes"
        description="Save every driver with bus and route details, then remove records whenever the transport roster changes."
      />

      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <FormTitle title="Add Driver Record" description="All fields are required. Typed text appears in capital letters." />
        <form className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3" onSubmit={onSave} noValidate>
          <CreativeInput
            label="Driver Name"
            value={driverForm.driverName}
            onChange={(e) => updateDriverField('driverName', e.target.value)}
            placeholder="Enter driver full name"
            error={driverFormErrors.driverName}
          />
          <CreativeInput
            label="Driver Phone"
            value={driverForm.driverPhone}
            onChange={(e) => updateDriverField('driverPhone', e.target.value)}
            placeholder="Enter 10 digit mobile number"
            inputMode="numeric"
            maxLength={10}
            error={driverFormErrors.driverPhone}
          />
          <CreativeInput
            label="License Number"
            value={driverForm.driverLicense}
            onChange={(e) => updateDriverField('driverLicense', e.target.value)}
            placeholder="Enter license number"
            error={driverFormErrors.driverLicense}
          />
          <CreativeInput
            label="Salary"
            type="number"
            min="1"
            value={driverForm.salary}
            onChange={(e) => updateDriverField('salary', e.target.value)}
            placeholder="Enter monthly salary"
            error={driverFormErrors.salary}
          />
          <CreativeInput
            label="Bus Number"
            value={driverForm.busNumber}
            onChange={(e) => updateDriverField('busNumber', e.target.value)}
            placeholder="Enter bus registration number"
            error={driverFormErrors.busNumber}
          />
          <CreativeInput
            label="Route Name"
            value={driverForm.routeName}
            onChange={(e) => updateDriverField('routeName', e.target.value)}
            placeholder="Enter route name"
            error={driverFormErrors.routeName}
          />
          <CreativeSelect
            label="Vehicle Type"
            value={driverForm.vehicleType}
            onChange={(e) => updateDriverField('vehicleType', e.target.value)}
            options={['', 'School Bus', 'Mini Bus', 'Van']}
            error={driverFormErrors.vehicleType}
          />
          <CreativeInput
            label="Seat Capacity"
            type="number"
            min="1"
            value={driverForm.seatCapacity}
            onChange={(e) => updateDriverField('seatCapacity', e.target.value)}
            placeholder="Enter total seat capacity"
            error={driverFormErrors.seatCapacity}
          />
          <div className="md:col-span-2 lg:col-span-3">
            <CreativeTextarea
              label="Bus Start Point"
              value={driverForm.pickupPoints}
              onChange={(e) => updateDriverField('pickupPoints', e.target.value)}
              placeholder="Enter bus start point"
              error={driverFormErrors.pickupPoints}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <PrimaryButton type="submit" icon={Plus} label={isSaving ? 'Saving Driver...' : 'Save Driver Record'} disabled={isSaving} />
          </div>
        </form>
      </section>

      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FormTitle title="Saved Drivers" description="Saved driver records are shown below the form in table format." />
          <SearchInput value={searchValue} onChange={onSearch} placeholder="Search driver, salary, bus, route, phone..." />
        </div>

        {filteredDrivers.length > 0 ? (
          <div className="mt-8 overflow-x-auto rounded-[1.6rem] border border-slate-200">
            <table className="min-w-[980px] w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  {['Driver', 'Mobile', 'License', 'Bus Number', 'Route', 'Vehicle', 'Salary', 'Start Point', 'Action'].map((heading) => (
                    <th key={heading} className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="align-top transition hover:bg-sky-50/50">
                    <td className="px-4 py-4 text-sm font-black text-slate-950">{driver.driverName || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">{driver.driverPhone || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">{driver.driverLicense || '-'}</td>
                    <td className="px-4 py-4 text-sm font-black uppercase text-sky-700">{driver.busNumber || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">{driver.routeName || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                      {driver.vehicleType || '-'}{driver.seatCapacity ? `, ${driver.seatCapacity} Seats` : ''}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">{driver.salary ? `INR ${driver.salary}` : '-'}</td>
                    <td className="max-w-[220px] px-4 py-4 text-sm font-semibold leading-6 text-slate-700">{driver.pickupPoints || '-'}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onDelete(driver.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete ${driver.driverName || 'driver'}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No driver records yet" description="Add the first driver with bus and route details to start transport mapping." />
        )}
      </section>
    </div>
  );
};

const StudentSection = ({
  studentForm,
  setStudentForm,
  students,
  classOptions,
  sectionOptions,
  filteredStudentOptions,
  drivers,
  transportStudents,
  filteredTransportStudents,
  selectedDriverId,
  setSelectedDriverId,
  isStudentFormOpen,
  setIsStudentFormOpen,
  onSearch,
  searchValue,
  onSave,
  onLookupStudent,
  isSaving,
  onDelete,
}) => {
  const selectedDriver = drivers.find((driver) => String(driver.routeId) === String(selectedDriverId)) || null;
  const selectedDriverAssignments = transportStudents.filter((record) => String(record.routeId || '') === String(selectedDriverId));
  const visibleDriverAssignments = filteredTransportStudents.filter((record) => String(record.routeId || '') === String(selectedDriverId));
  const selectedStudent = useMemo(() => (
    students.find((student) => String(student.id) === String(studentForm.studentId || '')) || null
  ), [studentForm.studentId, students]);
  const studentEnrollmentOptions = useMemo(() => (
    students
      .filter((student) => student.enrollmentNo)
      .sort((left, right) => String(left.enrollmentNo || '').localeCompare(String(right.enrollmentNo || '')))
  ), [students]);

  const selectStudent = (student, extraFormValues = {}) => {
    setStudentForm({
      ...studentForm,
      ...extraFormValues,
      enrollmentNo: student?.enrollmentNo || '',
      studentId: student ? String(student.id) : '',
      studentName: student ? getStudentFullName(student) : '',
      fatherName: student?.guardianName || '',
      className: student ? getStudentClassName(student) : '',
      section: student ? getStudentSection(student) : '',
    });
  };

  const handleEnrollmentChange = (value, extraFormValues = {}, shouldLookup = false) => {
    const normalizedValue = String(value || '').trim();
    const foundStudent = students.find((student) => String(student.enrollmentNo || '').toLowerCase() === normalizedValue.toLowerCase());
    if (foundStudent) {
      selectStudent(foundStudent, extraFormValues);
      return;
    }
    setStudentForm({
      ...studentForm,
      ...extraFormValues,
      enrollmentNo: value,
      studentId: '',
      studentName: '',
      fatherName: '',
      className: '',
      section: '',
    });
    if (shouldLookup && normalizedValue.length >= 2) {
      onLookupStudent(normalizedValue, extraFormValues);
    }
  };

  const openDriverStudents = (driverId) => {
    setSelectedDriverId(String(driverId));
    setIsStudentFormOpen(false);
    onSearch('');
    const route = drivers.find((item) => String(item.routeId) === String(driverId));
    setStudentForm({
      ...initialStudentForm,
      assignedDriverId: route?.driverId ? String(route.driverId) : '',
      routeId: String(driverId),
    });
  };

  const openStudentForm = () => {
    setIsStudentFormOpen(true);
    setStudentForm({
      ...initialStudentForm,
      assignedDriverId: selectedDriver?.driverId ? String(selectedDriver.driverId) : '',
      routeId: selectedDriverId,
    });
  };

  const handleSelectedDriverSave = async (event) => {
    await onSave(event);
    setIsStudentFormOpen(false);
  };

  if (!selectedDriver) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            eyebrow="Student Section"
            title="Choose a driver"
            description="Open a driver to see saved students and add new student transport assignments."
          />
          <button
            type="button"
            onClick={() => {
              setIsStudentFormOpen(true);
              setStudentForm(initialStudentForm);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-cyan-600"
          >
            <Plus size={14} />
            Add Student
          </button>
        </div>

        {isStudentFormOpen ? (
          <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <FormTitle title="Add Student Transport" description="Choose a driver, pick a student, and save the assignment." />
            <form className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSelectedDriverSave}>
              <StudentEnrollmentField
                value={studentForm.enrollmentNo}
                onChange={(value, shouldLookup) => handleEnrollmentChange(value, {}, shouldLookup)}
                students={studentEnrollmentOptions}
              />
              <CreativeInput label="Student Name" value={studentForm.studentName || (selectedStudent ? getStudentFullName(selectedStudent) : '')} readOnly placeholder="Auto filled from enrollment ID" />
              <CreativeInput label="Father Name" value={studentForm.fatherName || selectedStudent?.guardianName || ''} readOnly placeholder="Auto filled from student record" />
              <CreativeInput label="Class" value={studentForm.className || (selectedStudent ? getStudentClassName(selectedStudent) : '')} readOnly placeholder="Auto filled" />
              <CreativeInput label="Section" value={studentForm.section || (selectedStudent ? getStudentSection(selectedStudent) : '')} readOnly placeholder="Auto filled" />
              <CreativeSelect
                label="Assign Route"
                value={studentForm.routeId}
                onChange={(e) => {
                  const route = drivers.find((driver) => String(driver.routeId) === e.target.value);
                  setStudentForm({
                    ...studentForm,
                    routeId: e.target.value,
                    assignedDriverId: route?.driverId ? String(route.driverId) : '',
                    pickupStopId: '',
                    pickupStop: '',
                  });
                }}
                options={['', ...drivers.map((driver) => String(driver.routeId))]}
                renderOptionLabel={(value) => {
                  if (!value) return drivers.length ? 'Choose route' : 'No routes available';
                  const found = drivers.find((driver) => String(driver.routeId) === value);
                  return found ? `${found.driverName} | ${found.busNumber || 'Bus pending'} | ${found.routeName || 'Route pending'}`.toUpperCase() : value;
                }}
              />
              <CreativeSelect
                label="Pickup Stop"
                value={studentForm.pickupStopId}
                onChange={(e) => {
                  const route = drivers.find((driver) => String(driver.routeId) === String(studentForm.routeId));
                  const stop = (route?.stops || []).find((item) => String(item.id) === e.target.value);
                  setStudentForm({ ...studentForm, pickupStopId: e.target.value, pickupStop: stop?.stopName || '' });
                }}
                options={['', ...((drivers.find((driver) => String(driver.routeId) === String(studentForm.routeId))?.stops || []).map((stop) => String(stop.id)))]}
                renderOptionLabel={(value) => {
                  if (!value) return studentForm.routeId ? 'Choose pickup stop' : 'Choose route first';
                  const route = drivers.find((driver) => String(driver.routeId) === String(studentForm.routeId));
                  const stop = (route?.stops || []).find((item) => String(item.id) === value);
                  return stop?.stopName || value;
                }}
              />
              <div className="md:col-span-2 lg:col-span-3">
                <PrimaryButton type="submit" icon={Plus} label={isSaving ? 'Saving Student Transport...' : 'Save Student Transport'} disabled={isSaving || !studentForm.studentId || !studentForm.routeId || !studentForm.pickupStopId} />
              </div>
            </form>
          </section>
        ) : null}

        {drivers.length > 0 ? (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => {
              const studentCount = driver.assignedStudentCount ?? transportStudents.filter((record) => String(record.routeId || '') === String(driver.routeId)).length;
              return (
                <button
                  key={driver.routeId}
                  type="button"
                  onClick={() => openDriverStudents(driver.routeId)}
                  className="rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_24px_60px_-30px_rgba(6,182,212,0.28)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                      <Users size={20} />
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {studentCount} Students
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-black uppercase tracking-tight text-slate-950">{driver.driverName || 'Driver'}</h3>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">{driver.busNumber || 'Bus pending'}</p>
                  <p className="mt-3 text-sm font-semibold uppercase leading-6 text-slate-500">{driver.routeName || 'Route pending'}</p>
                </button>
              );
            })}
          </section>
        ) : (
          <EmptyState icon={Bus} title="No drivers available" description="Add a driver first, then student transport assignments can be created under that driver." />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Student Section"
          title={selectedDriver.driverName || 'Driver Students'}
          description={`${selectedDriver.busNumber || 'Bus pending'} | ${selectedDriver.routeName || 'Route pending'}`}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setSelectedDriverId('');
              setIsStudentFormOpen(false);
              onSearch('');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700"
          >
            <ArrowLeft size={14} />
            All Drivers
          </button>
          <button
            type="button"
            onClick={openStudentForm}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-cyan-600"
          >
            <Plus size={14} />
            Add Student
          </button>
        </div>
      </div>

      {isStudentFormOpen ? (
        <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
          <FormTitle title="Add Student Transport" description="Pick a student and save the assignment under this driver." />
          <form className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSelectedDriverSave}>
            <StudentEnrollmentField
              value={studentForm.enrollmentNo}
              onChange={(value, shouldLookup) => handleEnrollmentChange(value, {
                assignedDriverId: selectedDriver?.driverId ? String(selectedDriver.driverId) : '',
                routeId: selectedDriverId,
              }, shouldLookup)}
              students={studentEnrollmentOptions}
            />
            <CreativeInput label="Student Name" value={studentForm.studentName || (selectedStudent ? getStudentFullName(selectedStudent) : '')} readOnly placeholder="Auto filled from enrollment ID" />
            <CreativeInput label="Father Name" value={studentForm.fatherName || selectedStudent?.guardianName || ''} readOnly placeholder="Auto filled from student record" />
            <CreativeInput label="Class" value={studentForm.className || (selectedStudent ? getStudentClassName(selectedStudent) : '')} readOnly placeholder="Auto filled" />
            <CreativeInput label="Section" value={studentForm.section || (selectedStudent ? getStudentSection(selectedStudent) : '')} readOnly placeholder="Auto filled" />
            <CreativeSelect
              label="Pickup Stop"
              value={studentForm.pickupStopId}
              onChange={(e) => {
                const stop = (selectedDriver?.stops || []).find((item) => String(item.id) === e.target.value);
                setStudentForm({
                  ...studentForm,
                  pickupStopId: e.target.value,
                  pickupStop: stop?.stopName || '',
                  assignedDriverId: selectedDriver?.driverId ? String(selectedDriver.driverId) : '',
                  routeId: selectedDriverId,
                });
              }}
              options={['', ...((selectedDriver?.stops || []).map((stop) => String(stop.id)))]}
              renderOptionLabel={(value) => {
                if (!value) return selectedDriver?.stops?.length ? 'Choose pickup stop' : 'No stops available';
                const stop = (selectedDriver?.stops || []).find((item) => String(item.id) === value);
                return stop?.stopName || value;
              }}
            />
            <div className="md:col-span-2 lg:col-span-3">
              <PrimaryButton type="submit" icon={Plus} label={isSaving ? 'Saving Student Transport...' : 'Save Student Transport'} disabled={isSaving || !studentForm.studentId || !studentForm.routeId || !studentForm.pickupStopId} />
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FormTitle title="Saved Students" description={`${selectedDriverAssignments.length} students saved under this driver.`} />
          <SearchInput value={searchValue} onChange={onSearch} placeholder="Search student, class, pickup stop..." />
        </div>

        {visibleDriverAssignments.length > 0 ? (
          <div className="mt-8 overflow-x-auto rounded-[1.6rem] border border-slate-200">
            <table className="min-w-[760px] w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  {['Student Name', 'Class / Section', 'Pickup Stop', 'Bus Number', 'Route', 'Action'].map((heading) => (
                    <th key={heading} className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleDriverAssignments.map((record) => (
                  <tr key={record.id} className="align-top transition hover:bg-cyan-50/50">
                    <td className="px-4 py-4 text-sm font-black uppercase text-slate-950">{record.studentName || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold uppercase text-slate-700">{record.className || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold uppercase text-slate-700">{record.pickupStop || '-'}</td>
                    <td className="px-4 py-4 text-sm font-black uppercase text-cyan-700">{record.busNumber || '-'}</td>
                    <td className="px-4 py-4 text-sm font-semibold uppercase text-slate-700">{record.routeName || '-'}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onDelete(record.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete ${record.studentName || 'student assignment'}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Bus} title="No students under this driver" description="Use Add Student to attach a saved student to this driver's transport route." />
        )}
      </section>
    </div>
  );
};

const AttendanceSection = ({
  drivers,
  attendanceDriverId,
  setAttendanceDriverId,
  attendanceDate,
  setAttendanceDate,
  studentsUnderSelectedDriver,
  attendanceMap,
  onStatusChange,
  onSave,
  isSaving,
  recordSearch,
  setRecordSearch,
  monthlyAttendanceRegister,
}) => (
  <div className="space-y-8">
    <SectionHeader
      eyebrow="Attendance Section"
      title="Driver attendance card"
      description="Choose a driver, open the route students, and mark whether each student came to school through transport or not."
    />

    <div className="space-y-8">
      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <FormTitle title="Mark Transport Attendance" description="This works like the regular attendance sheet, but only for students assigned under the selected driver." />
        <form className="mt-8 space-y-8" onSubmit={onSave}>
          <div className="grid gap-5 md:grid-cols-2">
            <CreativeSelect
              label="Driver"
              value={attendanceDriverId}
              onChange={(e) => setAttendanceDriverId(e.target.value)}
              options={['', ...drivers.map((driver) => String(driver.routeId))]}
              renderOptionLabel={(value) => {
                if (!value) return drivers.length ? 'Choose route' : 'No routes available';
                const found = drivers.find((driver) => String(driver.routeId) === value);
                return found ? `${found.driverName} | ${found.busNumber || 'Bus pending'} | ${found.routeName || 'Route pending'}` : value;
              }}
            />
            <CreativeInput label="Date" type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
          </div>

          {studentsUnderSelectedDriver.length > 0 ? (
            <div className="overflow-hidden rounded-[1.8rem] border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-white">
                  <tr className="text-[11px] font-black uppercase tracking-[0.24em]">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Pickup Stop</th>
                    <th className="px-6 py-4 text-center">Present</th>
                    <th className="px-6 py-4 text-center">Absent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {studentsUnderSelectedDriver.map((record) => {
                    const studentKey = String(record.studentId);
                    return (
                      <tr key={record.id} className="transition hover:bg-sky-50/50">
                        <td className="px-6 py-5 text-sm font-black text-slate-950">{record.studentName || 'Student'}</td>
                        <td className="px-6 py-5 text-sm font-semibold text-slate-600">{record.className || '-'}</td>
                        <td className="px-6 py-5 text-sm font-semibold text-slate-600">{record.pickupStop || '-'}</td>
                        <td className="px-6 py-5 text-center">
                          <button
                            type="button"
                            onClick={() => onStatusChange(studentKey, 'Present')}
                            className={`min-w-28 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                              attendanceMap[studentKey] === 'Present'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                                : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'
                            }`}
                          >
                            Present
                          </button>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <button
                            type="button"
                            onClick={() => onStatusChange(studentKey, 'Absent')}
                            className={`min-w-28 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                              attendanceMap[studentKey] === 'Absent'
                                ? 'bg-rose-600 text-white shadow-lg shadow-rose-100'
                                : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-rose-300 hover:text-rose-700'
                            }`}
                          >
                            Absent
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No route students available" description="Assign students under a driver first, then the transport attendance card will appear here." />
          )}

          <PrimaryButton
            type="submit"
            icon={ClipboardCheck}
            label={isSaving ? 'Saving Attendance...' : 'Save Transport Attendance'}
            disabled={!attendanceDriverId || studentsUnderSelectedDriver.length === 0 || studentsUnderSelectedDriver.some((record) => !attendanceMap[String(record.studentId)]) || isSaving}
          />
        </form>
      </section>

      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <FormTitle title="Saved Attendance Register" description="Monthly P/A register for the selected driver, just like the regular saved attendance sheet." />
        <div className="mt-6">
          <SearchInput value={recordSearch} onChange={setRecordSearch} placeholder="Search student or class..." />
        </div>

        {monthlyAttendanceRegister?.rows?.length ? (
          <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <p className="text-center text-lg font-black tracking-tight text-slate-950">{monthlyAttendanceRegister.driverName}</p>
              <p className="mt-2 text-center text-sm font-semibold text-slate-600">
                Route: {monthlyAttendanceRegister.routeName} | Bus: {monthlyAttendanceRegister.busNumber}
              </p>
              <p className="mt-1 text-center text-sm font-semibold text-slate-600">
                Month: {monthlyAttendanceRegister.monthLabel}
              </p>
            </div>
            <div className="flex w-full overflow-hidden">
              <div className="shrink-0 border-r border-slate-200 bg-white">
                <table className="border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-950 text-white">
                      <th className="min-w-56 border-b border-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em]">
                        Student Name
                      </th>
                      <th className="min-w-36 border-b border-l border-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em]">
                        Class
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAttendanceRegister.rows.map((row) => (
                      <tr key={`student-${row.id}`} className="odd:bg-white even:bg-slate-50">
                        <td className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-950">
                          {row.name}
                        </td>
                        <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
                          {row.className || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="min-w-0 flex-1 overflow-x-auto">
                <table className="w-max border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-950 text-white">
                      {monthlyAttendanceRegister.dayColumns.map((dayNumber) => (
                        <th
                          key={`day-${dayNumber}`}
                          className="min-w-14 border-b border-l border-slate-800 px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em]"
                        >
                          {dayNumber}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAttendanceRegister.rows.map((row) => (
                      <tr key={`days-${row.id}`} className="odd:bg-white even:bg-slate-50">
                        {row.days.map((value, index) => (
                          <td
                            key={`${row.id}-day-${monthlyAttendanceRegister.dayColumns[index]}`}
                            className={`min-w-14 border-b border-l border-slate-200 px-3 py-3 text-sm font-black ${
                              value === 'P'
                                ? 'text-emerald-700'
                                : value === 'A'
                                  ? 'text-rose-700'
                                  : 'text-slate-300'
                            }`}
                          >
                            {value || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState icon={ClipboardCheck} title="No transport attendance register yet" description="Driver select karke attendance save karo, fir monthly P/A register yahin dikh jayega." />
        )}
      </section>
    </div>
  </div>
);

const EntryCard = ({ icon: Icon, title, description, meta, buttonLabel, onClick }) => (
  <button
    onClick={onClick}
    className="group rounded-4xl border border-slate-200/80 bg-white p-7 text-left shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] transition hover:-translate-y-1.5 hover:border-sky-200 hover:shadow-[0_24px_60px_-30px_rgba(14,165,233,0.3)]"
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#dbeafe_0%,#cffafe_100%)] text-sky-700 transition group-hover:scale-105">
      <Icon size={24} />
    </div>
    <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">{description}</p>
    <div className="mt-6 flex items-center justify-between gap-4">
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {meta}
      </span>
      <span className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">{buttonLabel}</span>
    </div>
  </button>
);

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">{label}</p>
        <p className="mt-3 text-4xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-100">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const SectionHeader = ({ eyebrow, title, description }) => (
  <div>
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-sky-600">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-4xl font-black italic leading-none tracking-tight text-slate-950">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>
    </div>
  </div>
);

const FormTitle = ({ title, description }) => (
  <div>
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
    />
  </div>
);

const CreativeInput = ({ label, error = '', ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${
        error
          ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
          : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
      }`}
      {...props}
    />
    {error ? (
      <p className="text-xs font-semibold text-rose-600">{error}</p>
    ) : null}
  </div>
);

const StudentEnrollmentField = ({ value, onChange, students }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Student Enrollment ID</label>
    <input
      list="transport-student-enrollment-options"
      value={value}
      onChange={(event) => onChange(event.target.value, false)}
      onBlur={(event) => onChange(event.target.value, true)}
      placeholder="Enter or choose enrollment ID"
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold uppercase text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
    />
    <datalist id="transport-student-enrollment-options">
      {students.map((student) => (
        <option key={student.id} value={student.enrollmentNo}>
          {`${student.enrollmentNo} | ${getStudentFullName(student)}`}
        </option>
      ))}
    </datalist>
  </div>
);

const CreativeSelect = ({ label, options, renderOptionLabel, error = '', ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
        error
          ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
          : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
      }`}
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
        </option>
      ))}
    </select>
    {error ? (
      <p className="text-xs font-semibold text-rose-600">{error}</p>
    ) : null}
  </div>
);

const CreativeTextarea = ({ label, error = '', ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className={`min-h-32 w-full rounded-2xl border-2 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${
        error
          ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
          : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
      }`}
      {...props}
    />
    {error ? (
      <p className="text-xs font-semibold text-rose-600">{error}</p>
    ) : null}
  </div>
);

const PrimaryButton = ({ type, icon: Icon, label, disabled = false }) => (
  <button
    type={type}
    disabled={disabled}
    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
      disabled ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-950 text-white hover:bg-sky-600'
    }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

const InfoPill = ({ icon: Icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    <Icon size={15} className="text-sky-700" />
    <span>{text}</span>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Icon size={34} />
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const getStudentFullName = (student) => (
  `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || student?.name || 'Unnamed student'
);

const getStudentClassName = (student) => {
  const assignedClass = String(student?.assignedClass || '').trim();
  if (assignedClass.includes('/')) return assignedClass.split('/')[0].trim();
  return student?.className || assignedClass || '';
};

const getStudentSection = (student) => {
  const assignedClass = String(student?.assignedClass || '').trim();
  if (assignedClass.includes('/')) return assignedClass.split('/').slice(1).join('/').trim();
  return student?.section || '';
};

export default TransportManagement;
