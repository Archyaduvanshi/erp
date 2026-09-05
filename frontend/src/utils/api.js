const resolveApiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080/api';
  const trimmedUrl = configuredUrl.replace(/\/+$/, '');

  return trimmedUrl.endsWith('/api') ? trimmedUrl : `${trimmedUrl}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();
export const DAILY_ATTENDANCE_PERIOD_NUMBER = 1;
const AUTH_SESSION_STORAGE_KEY = 'erp.auth.session';
const ACCESS_TOKEN_STORAGE_KEY = 'erp.auth.accessToken';
const AUTH_SESSION_CLEARED_EVENT = 'erp:auth-session-cleared';
let accessToken = readStoredAccessToken();
let refreshPromise = null;
let cachedSession = null;
const ACCESS_TOKEN_REFRESH_SKEW_SECONDS = 60;

const FEATURE_ROUTE_MAP = {
  admissionStudent: '/college/students',
  teacher: '/college/teachers',
  library: '/college/library',
  hostel: '/college/hostel',
  fees: '/college/fees',
  transport: '/college/transport',
  attendance: '/college/attendance',
  courses: '/college/courses',
  examinations: '/college/examinations',
  timetable: '/college/timetable',
  salary: '/college/salary',
  cashbook: '/college/cashbook',
  notices: '/college/notices',
  holidays: '/college/holidays',
};

const readStoredSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearStoredAuthSession = () => {
  cachedSession = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
  } catch {
    // Browser storage can be unavailable in private/restricted contexts.
  }
};

const toQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const warmApi = () => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  return fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: controller.signal,
  })
    .catch(() => null)
    .finally(() => window.clearTimeout(timeoutId));
};

export const setAccessToken = (token = '') => {
  accessToken = token || '';
  if (typeof window === 'undefined') return;
  try {
    if (accessToken) {
      window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    } else {
      window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Keep the in-memory token even when browser storage is blocked.
  }
};

function readStoredAccessToken() {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
      || window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
      || '';
  } catch {
    return '';
  }
}

async function request(path, options = {}) {
  return requestWithAuth(path, options, true);
}

async function requestWithAuth(path, options = {}, allowRefresh) {
  assertTeacherWriteAllowed(options);
  const publicRequest = isPublicApiPath(path);
  if (!publicRequest && allowRefresh && (!accessToken || isAccessTokenExpiring(accessToken))) {
    await refreshAccessToken();
  }
  if (!publicRequest && !accessToken) {
    throw new Error('Session expired. Please login again before saving.');
  }
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!publicRequest && accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!publicRequest && response.status === 401 && allowRefresh && path !== '/auth/refresh') {
    setAccessToken('');
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestWithAuth(path, options, false);
    }
    throw new Error('Session expired. Please login again before saving.');
  }

  if (!response.ok) {
    let message = 'Something went wrong while contacting the server.';
    let fieldErrors = {};

    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
      fieldErrors = errorBody.fieldErrors || {};
    } catch {
      message = response.statusText || message;
    }

    const error = new Error(message);
    error.fieldErrors = fieldErrors;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function doRefreshAccessToken() {
  const tokenBeforeRefresh = accessToken;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      if (accessToken === tokenBeforeRefresh) {
        setAccessToken('');
        clearStoredAuthSession();
      }
      return false;
    }
    const session = await response.json();
    setAccessToken(response.headers.get('X-Access-Token') || session?.accessToken || '');
    if (session?.instituteId) {
      persistAuthSession(fromAuthMe(session));
    }
    return Boolean(accessToken);
  } catch {
    if (accessToken === tokenBeforeRefresh) {
      setAccessToken('');
      clearStoredAuthSession();
    }
    return false;
  }
}

function isAccessTokenExpiring(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  const expiresAtSeconds = Number(payload.exp);
  if (!Number.isFinite(expiresAtSeconds)) return true;
  return expiresAtSeconds <= Math.floor(Date.now() / 1000) + ACCESS_TOKEN_REFRESH_SKEW_SECONDS;
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function persistAuthSession(session) {
  const activeSession = cachedSession || readStoredSession() || {};
  const nextSession = {
    ...activeSession,
    ...session,
    role: String(session.role || activeSession.role || '').toLowerCase(),
    assignedFeatures: session.assignedFeatures || activeSession.assignedFeatures || [],
  };
  if (nextSession.accessToken) {
    setAccessToken(nextSession.accessToken);
  }
  cachedSession = nextSession;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    } catch {
      // Browser storage can be unavailable in private/restricted contexts.
    }
  }
  return nextSession;
}

function fromAuthMe(session) {
  return {
    authenticated: true,
    id: session.instituteId,
    username: session.username,
    role: session.role,
    teacherId: session.teacherId,
    studentId: session.studentId,
    mustChangePassword: Boolean(session.mustChangePassword),
    assignedFeatures: session.permissions || [],
  };
}

function shouldAttemptRefreshBeforeRequest(path) {
  return !isPublicApiPath(path);
}

function isPublicApiPath(path) {
  if (path === '/auth/refresh') return true;
  return [
    '/health',
    '/settings/login',
    '/auth/password/forgot',
    '/auth/password/reset',
    '/institutes/register',
    '/institutes/login',
    '/uploads/registration-logo',
  ].some((publicPath) => path === publicPath || path.startsWith(`${publicPath}?`));
}

function assertTeacherWriteAllowed(options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  const session = cachedSession || readStoredSession();
  if (session?.role !== 'teacher') return;
  const pathname = window.location?.pathname || '';
  const assignedFeatures = Array.isArray(session.assignedFeatures) ? session.assignedFeatures : [];
  const currentFeature = assignedFeatures.find((feature) => {
    const route = FEATURE_ROUTE_MAP[feature.feature];
    return feature.enabled && route && pathname.startsWith(route);
  });
  if (currentFeature?.operation === 'read') {
    throw new Error('Read only permission hai. Is feature me add, update, delete allowed nahi hai.');
  }
}

export const instituteApi = {
  register: (payload) =>
    request('/institutes/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request('/institutes/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getById: (id) => request(`/institutes/${id}`),

  update: (id, payload) =>
    request(`/institutes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  changePassword: (id, payload) =>
    request(`/institutes/${id}/password`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const settingsApi = {
  get: () => request('/settings', withInstituteHeaders()),

  getAcademicYear: () => request('/settings/academic-year', withInstituteHeaders()),

  savePreferences: (payload) =>
    request('/settings/preferences', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  saveNotifications: (payload) =>
    request('/settings/notifications', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  saveFeatureAccess: (payload) =>
    request('/settings/feature-access', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  login: (payload) =>
    request('/settings/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getTeacherFeatureAccess: (teacherId) =>
    request(`/settings/teachers/${teacherId}/feature-access`, withInstituteHeaders()),

  reset: () =>
    request('/settings', withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const authApi = {
  me: () => request('/auth/me'),
  getSession: async () => persistAuthSession(fromAuthMe(await request('/auth/me'))),
  getCachedSession: () => cachedSession || readStoredSession(),
  persistSession: persistAuthSession,
  forgotPassword: (payload) =>
    request('/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload) =>
    request('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  changePassword: (payload) =>
    request('/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: async () => {
    try {
      return await request('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken('');
      clearStoredAuthSession();
    }
  },
  logoutAll: async () => {
    try {
      return await request('/auth/logout-all', { method: 'POST' });
    } finally {
      setAccessToken('');
      clearStoredAuthSession();
    }
  },
};

const withInstituteHeaders = (options = {}) => {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };
};

const withPortalHeaders = (role, options = {}) => {
  return withInstituteHeaders(options);
};

export const studentApi = {
  getAll: () => request('/students', withInstituteHeaders()),

  getClassSummary: () => request('/students/class-summary', withInstituteHeaders()),

  getPage: ({ page = 0, size = 25, assignedClass = '', search = '', status = '', sort = 'createdAt,desc' } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('size', String(size));
    if (assignedClass) params.set('assignedClass', assignedClass);
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);
    return request(`/students?${params.toString()}`, withInstituteHeaders());
  },

  getById: (id) => request(`/students/${id}`, withInstituteHeaders()),

  create: (payload) =>
    request('/students', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  update: (id, payload) =>
    request(`/students/${id}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  import: (payload) =>
    request('/students/import', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  updateFacilities: (id, payload) =>
    request(`/students/${id}/facilities`, withInstituteHeaders({
      method: 'PATCH',
      body: JSON.stringify(payload),
    })),

  delete: (id) =>
    request(`/students/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const teacherApi = {
  getAll: () => request('/teachers', withInstituteHeaders()),

  getMyDashboard: () => request('/teachers/me/dashboard', withPortalHeaders('teacher')),

  getOptions: (status = 'Active') => request(`/teachers/options?status=${encodeURIComponent(status)}`, withInstituteHeaders()),

  getPage: ({ page = 0, size = 20, search = '', status = '', specialization = '', contractType = '', sort = 'createdAt,desc' } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('size', String(size));
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (specialization) params.set('specialization', specialization);
    if (contractType) params.set('contractType', contractType);
    if (sort) params.set('sort', sort);
    return request(`/teachers?${params.toString()}`, withInstituteHeaders());
  },

  getById: (id) => request(`/teachers/${id}`, withInstituteHeaders()),

  create: (payload) =>
    request('/teachers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  update: (id, payload) =>
    request(`/teachers/${id}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  import: (payload) =>
    request('/teachers/import', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  delete: (id) =>
    request(`/teachers/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const transportApi = {
  getOverview: (date) =>
    request(`/transport/overview${date ? `?date=${encodeURIComponent(date)}` : ''}`, withInstituteHeaders()),

  getDrivers: () => request('/transport/drivers', withInstituteHeaders()),

  getRouteOperations: ({ academicSessionId, date } = {}) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    if (date) params.set('date', date);
    const query = params.toString();
    return request(`/transport/route-operations${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  createDriver: (payload) =>
    request('/transport/drivers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteDriver: (id) =>
    request(`/transport/drivers/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getAssignments: (academicSessionId) =>
    request(`/transport/assignments${academicSessionId ? `?academicSessionId=${encodeURIComponent(academicSessionId)}` : ''}`, withInstituteHeaders()),

  getDriverAssignments: (driverId, academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/transport/drivers/${driverId}/assignments${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getRouteAssignments: (routeId, academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/transport/routes/${routeId}/assignments${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  lookupStudent: (enrollmentNo) =>
    request(`/transport/students/lookup?enrollmentNo=${encodeURIComponent(enrollmentNo)}`, withInstituteHeaders()),

  saveAssignment: (payload) =>
    request('/transport/assignments', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteAssignment: (id) =>
    request(`/transport/assignments/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getAttendance: (driverId) =>
    request(`/transport/attendance${driverId ? `?driverId=${driverId}` : ''}`, withInstituteHeaders()),

  getDailyAttendance: ({ driverId, date }) =>
    request(`/transport/drivers/${driverId}/attendance/daily?date=${encodeURIComponent(date)}`, withInstituteHeaders()),

  getMonthlyAttendance: ({ driverId, month }) =>
    request(`/transport/drivers/${driverId}/attendance/monthly?month=${encodeURIComponent(month)}`, withInstituteHeaders()),

  getRouteDailyAttendance: ({ routeId, date }) =>
    request(`/transport/routes/${routeId}/attendance/daily?date=${encodeURIComponent(date)}`, withInstituteHeaders()),

  getRouteMonthlyAttendance: ({ routeId, month }) =>
    request(`/transport/routes/${routeId}/attendance/monthly?month=${encodeURIComponent(month)}`, withInstituteHeaders()),

  getMyAssignment: (academicSessionId) =>
    request(`/transport/student/me${academicSessionId ? `?academicSessionId=${encodeURIComponent(academicSessionId)}` : ''}`, withPortalHeaders('student')),

  getMyAttendance: (month) =>
    request(`/transport/student/me/attendance?month=${encodeURIComponent(month)}`, withPortalHeaders('student')),

  saveAttendance: (payload) =>
    request('/transport/attendance', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),
};

export const hostelApi = {
  getOverview: () => request('/hostel/overview', withInstituteHeaders()),

  getHostels: () => request('/hostel', withInstituteHeaders()),

  saveHostel: (payload) =>
    request('/hostel', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteHostel: (id) =>
    request(`/hostel/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getRooms: ({ hostelId = '', floor = '', status = '' } = {}) => {
    const params = new URLSearchParams();
    if (floor) params.set('floor', floor);
    if (status) params.set('status', status);
    const query = params.toString();
    if (hostelId) {
      return request(`/hostel/${hostelId}/rooms${query ? `?${query}` : ''}`, withInstituteHeaders());
    }
    return request(`/hostel/rooms${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  saveRoom: (payload) =>
    request('/hostel/rooms', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  updateRoom: (id, payload) =>
    request(`/hostel/rooms/${id}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  saveRooms: (payload) =>
    request('/hostel/rooms/bulk', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteRoom: (id) =>
    request(`/hostel/rooms/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getResidents: ({ hostelId = '', roomId = '', status = '', search = '', page = 0, size = 25 } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('size', String(size));
    if (hostelId) params.set('hostelId', hostelId);
    if (roomId) params.set('roomId', roomId);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    return request(`/hostel/residents?${params.toString()}`, withInstituteHeaders());
  },

  getAllResidents: async ({ hostelId = '', roomId = '', status = '', search = '', size = 100 } = {}) => {
    const rows = [];
    let page = 0;
    let totalPages = 1;
    do {
      const response = await hostelApi.getResidents({ hostelId, roomId, status, search, page, size });
      const content = Array.isArray(response) ? response : response?.content || [];
      rows.push(...content);
      totalPages = Array.isArray(response) ? 1 : Number(response?.totalPages || 1);
      page += 1;
    } while (page < totalPages);
    return rows;
  },

  getRoomResidents: (roomId, { status = '', page = 0, size = 25 } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('size', String(size));
    if (status) params.set('status', status);
    return request(`/hostel/rooms/${roomId}/residents?${params.toString()}`, withInstituteHeaders());
  },

  getMyResident: () => request('/hostel/student/me', withPortalHeaders('student')),

  lookupStudent: (enrollmentNo) =>
    request(`/hostel/students/lookup?enrollmentNo=${encodeURIComponent(enrollmentNo)}`, withInstituteHeaders()),

  searchStudents: ({ search = '', className = '', section = '', page = 0, size = 25 } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('size', String(size));
    if (search) params.set('search', search);
    if (className) params.set('className', className);
    if (section) params.set('section', section);
    return request(`/hostel/students/search?${params.toString()}`, withInstituteHeaders());
  },

  saveResident: (payload) =>
    request('/hostel/residents', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  vacateResident: (id) =>
    request(`/hostel/residents/${id}/vacate`, withInstituteHeaders({
      method: 'PATCH',
    })),

  deleteResident: (id) =>
    request(`/hostel/residents/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getMessMenu: (hostelId) =>
    request(`/hostel/${hostelId}/mess-menu`, withInstituteHeaders()),

  saveMessMenu: (hostelId, payload) =>
    request(`/hostel/${hostelId}/mess-menu`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  getMessSummary: (hostelId) =>
    request(`/hostel/${hostelId}/mess-summary`, withInstituteHeaders()),
};

export const courseBookApi = {
  getAll: () => request('/course-books', withInstituteHeaders()),

  create: (payload) =>
    request('/course-books', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  update: (id, payload) =>
    request(`/course-books/${id}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  delete: (id) =>
    request(`/course-books/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const academicSessionApi = {
  getAll: () => request('/academic-sessions', withInstituteHeaders()),
};

export const subjectApi = {
  getAll: () => request('/subjects', withInstituteHeaders()),
};

export const curriculumApi = {
  getClassSummaries: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/curriculum/classes${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getClassSummaryRows: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/curriculum/classes/summary${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getClassOptions: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/curriculum/classes/options${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  createClass: (payload) =>
    request('/curriculum/classes', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  getSectionOptions: (classId) =>
    request(`/curriculum/classes/${classId}/sections/options`, withInstituteHeaders()),

  createSection: (classId, payload) =>
    request(`/curriculum/classes/${classId}/sections`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  updateSection: (classId, sectionId, payload) =>
    request(`/curriculum/classes/${classId}/sections/${sectionId}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  copy: (payload) =>
    request('/curriculum/copy', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),
};

export const classSubjectApi = {
  getByClass: (classId, academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/classes/${classId}/subjects${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  create: (payload) =>
    request('/class-subjects', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  bulkCreate: (payload) =>
    request('/class-subjects/bulk', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  archive: (id) =>
    request(`/class-subjects/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getBooks: (classSubjectId) => request(`/class-subjects/${classSubjectId}/books`, withInstituteHeaders()),

  createBook: (classSubjectId, payload) =>
    request(`/class-subjects/${classSubjectId}/books`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  updateBook: (classSubjectId, bookId, payload) =>
    request(`/class-subjects/${classSubjectId}/books/${bookId}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  deleteBook: (classSubjectId, bookId) =>
    request(`/class-subjects/${classSubjectId}/books/${bookId}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const feeApi = {
  getOverview: (filters = {}) => request(`/fees/overview${toQueryString(filters)}`, withInstituteHeaders()),

  getClasses: (filters = {}) => request(`/fees/classes${toQueryString(filters)}`, withInstituteHeaders()),

  getStructures: (filters = {}) => request(`/fees/structures${toQueryString(filters)}`, withInstituteHeaders()),

  saveStructure: (payload) =>
    request('/fees/structures', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteStructure: (id) =>
    request(`/fees/structures/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  searchStudents: (filters = {}) => request(`/fees/students/search${toQueryString(filters)}`, withInstituteHeaders()),

  getStudentSummary: (studentId, filters = {}) =>
    request(`/fees/students/${studentId}/summary${toQueryString(filters)}`, withInstituteHeaders()),

  getDues: (filters = {}) => request(`/fees/dues${toQueryString(filters)}`, withInstituteHeaders()),

  getReceipts: (filters = {}) => request(`/fees/receipts${toQueryString(filters)}`, withInstituteHeaders()),

  getPayments: (filters = {}) => {
    const normalizedFilters = typeof filters === 'object' ? filters : { studentId: filters };
    return request(`/fees/payments${toQueryString(normalizedFilters)}`, withInstituteHeaders());
  },

  getStudentPayments: (studentId, filters = {}) =>
    request(`/fees/students/${studentId}/payments${toQueryString(filters)}`, withInstituteHeaders()),

  savePayment: (payload) =>
    request('/fees/payments', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  saveMyPayment: (payload) =>
    request('/fees/student/me/payments', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  getMySummary: (filters = {}) => request(`/fees/student/me/summary${toQueryString(filters)}`, withInstituteHeaders()),

  getMyPayments: (filters = {}) => request(`/fees/student/me/payments${toQueryString(filters)}`, withInstituteHeaders()),

  voidPayment: (id, payload) =>
    request(`/fees/payments/${id}/void`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  verifyPayment: (id) =>
    request(`/fees/payments/${id}/verify`, withInstituteHeaders({
      method: 'POST',
    })),

  rejectPayment: (id, payload) =>
    request(`/fees/payments/${id}/reject`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deletePayment: (id) =>
    request(`/fees/payments/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const salaryApi = {
  getOverview: (filters = {}) => request(`/salary/overview${toQueryString(filters)}`, withInstituteHeaders()),

  getPayrollPeriods: (filters = {}) => request(`/salary/payroll-periods${toQueryString(filters)}`, withInstituteHeaders()),

  generatePayrollPeriod: (filters = {}) => request(`/salary/payroll-periods/generate${toQueryString(filters)}`, withInstituteHeaders({ method: 'POST' })),

  generatePayrollPeriodsForMonth: (filters = {}) => request(`/salary/payroll-periods/generate-month${toQueryString(filters)}`, withInstituteHeaders({ method: 'POST' })),

  getTeacherSummary: (teacherId, filters = {}) => request(`/salary/teachers/${teacherId}/summary${toQueryString(filters)}`, withInstituteHeaders()),

  getTeacherPayments: (teacherId, filters = {}) => request(`/salary/teachers/${teacherId}/payments${toQueryString(filters)}`, withInstituteHeaders()),

  getPayments: (teacherId) =>
    request(`/salary/payments${teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : ''}`, withInstituteHeaders()),

  getPaymentsPage: (filters = {}) => request(`/salary/payments/page${toQueryString(filters)}`, withInstituteHeaders()),

  savePayment: (payload) =>
    request('/salary/payments', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  voidPayment: (id, payload) =>
    request(`/salary/payments/${id}/void`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  getMySummary: (filters = {}) => request(`/salary/teacher/me/summary${toQueryString(filters)}`, withPortalHeaders('teacher')),

  getMyPayrollPeriods: (filters = {}) => request(`/salary/teacher/me/payroll-periods${toQueryString(filters)}`, withPortalHeaders('teacher')),

  getMyPayments: (filters = {}) => request(`/salary/teacher/me/payments${toQueryString(filters)}`, withPortalHeaders('teacher')),
};

export const cashbookApi = {
  getOverview: (filters = {}) => request(`/cashbook/overview${toQueryString(filters)}`, withInstituteHeaders()),

  getTrend: (filters = {}) => request(`/cashbook/trend${toQueryString(filters)}`, withInstituteHeaders()),

  getCategoryBreakdown: (filters = {}) => request(`/cashbook/categories/breakdown${toQueryString(filters)}`, withInstituteHeaders()),

  getPaymentModes: (filters = {}) => request(`/cashbook/payment-modes${toQueryString(filters)}`, withInstituteHeaders()),

  getTransactions: (filters = {}) => request(`/cashbook/transactions${toQueryString(filters)}`, withInstituteHeaders()),

  exportTransactions: (filters = {}) => request(`/cashbook/transactions/export${toQueryString(filters)}`, withInstituteHeaders()),

  getAccounts: () => request('/cashbook/accounts', withInstituteHeaders()),

  createAccount: (payload) =>
    request('/cashbook/accounts', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  getCategories: () => request('/cashbook/categories', withInstituteHeaders()),

  createCategory: (payload) =>
    request('/cashbook/categories', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  addIncome: (payload) =>
    request('/cashbook/income', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  addExpense: (payload) =>
    request('/cashbook/expenses', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  addRefund: (payload) =>
    request('/cashbook/refunds', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  transfer: (payload) =>
    request('/cashbook/transfers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  voidEntry: (id, payload) =>
    request(`/cashbook/entries/${id}/void`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),
};

export const timetableApi = {
  getSummary: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/timetables${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getClassTimetables: () => request('/timetables/classes', withInstituteHeaders()),

  getTeacherOccupancy: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/timetables/teacher-occupancy${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getTeacherTimetable: (teacherId, academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/timetables/teachers/${teacherId}${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getMyTeacherTimetable: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/teachers/me/timetable${query ? `?${query}` : ''}`, withPortalHeaders('teacher'));
  },

  getStudentTimetable: (studentId, academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/timetables/students/${studentId}${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  getMyStudentTimetable: (academicSessionId) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    const query = params.toString();
    return request(`/students/me/timetable${query ? `?${query}` : ''}`, withPortalHeaders('student'));
  },

  getClassTimetable: (classId, { academicSessionId, sectionId } = {}) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    if (sectionId) params.set('sectionId', sectionId);
    const query = params.toString();
    return request(`/timetables/classes/${classId}${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  saveClassTimetable: (payload) =>
    request('/timetables/classes', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteClassTimetable: (id) =>
    request(`/timetables/classes/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getTemplateDrafts: () => request('/timetables/template-drafts', withInstituteHeaders()),

  getTemplateDraft: (classId, { academicSessionId, sectionId } = {}) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    if (sectionId) params.set('sectionId', sectionId);
    const query = params.toString();
    return request(`/timetables/classes/${classId}/draft${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  saveTemplateDraft: (payload) =>
    request('/timetables/template-drafts', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  saveTemplateDraftForClass: (classId, payload, { academicSessionId, sectionId } = {}) => {
    const params = new URLSearchParams();
    if (academicSessionId) params.set('academicSessionId', academicSessionId);
    if (sectionId) params.set('sectionId', sectionId);
    const query = params.toString();
    return request(`/timetables/classes/${classId}/draft${query ? `?${query}` : ''}`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  },

  publishClassTimetable: (classId, payload) =>
    request(`/timetables/classes/${classId}/publish`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteTemplateDraft: (id) =>
    request(`/timetables/template-drafts/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const uploadApi = {
  uploadFile: (file, folder = '/erp/uploads') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return request('/uploads/imagekit', withInstituteHeaders({
      method: 'POST',
      body: formData,
    }));
  },

  uploadRegistrationLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return request('/uploads/registration-logo', {
      method: 'POST',
      body: formData,
    });
  },
};

export const examApi = {
  getOverview: (filters = {}) => request(`/examinations/overview${toQueryString(filters)}`, withInstituteHeaders()),

  getOptions: (filters = {}) => request(`/examinations/options${toQueryString(filters)}`, withInstituteHeaders()),

  getStudentMe: (filters = {}) => request(`/examinations/student/me${toQueryString(filters)}`, withPortalHeaders('student')),

  getTeacherMe: (filters = {}) => request(`/examinations/teacher/me${toQueryString(filters)}`, withPortalHeaders('teacher')),

  getDateSheets: (filters = {}) => request(`/examinations/date-sheets${toQueryString(filters)}`, withInstituteHeaders()),

  saveDateSheet: (payload) =>
    request('/examinations/date-sheets', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteDateSheet: (id) =>
    request(`/examinations/date-sheets/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getQuestionPapers: (filters = {}) => request(`/examinations/question-papers${toQueryString(filters)}`, withInstituteHeaders()),

  saveQuestionPaper: (payload) =>
    request('/examinations/question-papers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteQuestionPaper: (id) =>
    request(`/examinations/question-papers/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getAdmitCards: (filters = {}) => request(`/examinations/admit-cards${toQueryString(filters)}`, withInstituteHeaders()),

  saveAdmitCard: (payload) =>
    request('/examinations/admit-cards', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  generateAdmitCards: (payload) =>
    request('/examinations/admit-cards/bulk', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteAdmitCard: (id) =>
    request(`/examinations/admit-cards/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const attendanceApi = {
  getTargets: (academicSessionId) =>
    request(`/attendance/targets?academicSessionId=${encodeURIComponent(academicSessionId)}`, withInstituteHeaders()),

  getClassStudents: ({ academicSessionId, classId, sectionId }) => {
    const params = new URLSearchParams();
    params.set('academicSessionId', academicSessionId);
    if (sectionId) params.set('sectionId', sectionId);
    return request(`/attendance/classes/${classId}/students?${params.toString()}`, withInstituteHeaders());
  },

  getClassSession: ({ academicSessionId, classId, sectionId, date, periodNumber = DAILY_ATTENDANCE_PERIOD_NUMBER }) => {
    const params = new URLSearchParams();
    params.set('academicSessionId', academicSessionId);
    params.set('date', date);
    params.set('periodNumber', String(periodNumber));
    if (sectionId) params.set('sectionId', sectionId);
    return request(`/attendance/classes/${classId}/session?${params.toString()}`, withInstituteHeaders());
  },

  saveClassSession: ({ classId, ...payload }) =>
    request(`/attendance/classes/${classId}/session`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify({ classId, ...payload }),
    })),

  getClassMonthly: ({ academicSessionId, classId, sectionId, month, teacherId }) => {
    const params = new URLSearchParams();
    params.set('academicSessionId', academicSessionId);
    params.set('month', month);
    if (sectionId) params.set('sectionId', sectionId);
    if (teacherId) params.set('teacherId', teacherId);
    return request(`/attendance/classes/${classId}/monthly?${params.toString()}`, withInstituteHeaders());
  },

  getMyTeacherTargets: (academicSessionId) =>
    request(`/attendance/teachers/me/targets?academicSessionId=${encodeURIComponent(academicSessionId)}`, withPortalHeaders('teacher')),

  getMyStudentAttendance: (month) =>
    request(`/attendance/students/me?month=${encodeURIComponent(month)}`, withPortalHeaders('student')),

  getTeacherAttendanceDaily: (date) =>
    request(`/attendance/teachers/daily?date=${encodeURIComponent(date)}`, withInstituteHeaders()),

  getTeacherAttendanceMonthly: (month) =>
    request(`/attendance/teachers/monthly?month=${encodeURIComponent(month)}`, withInstituteHeaders()),

  saveTeacherAttendance: (payload) =>
    request('/attendance/teachers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

};

export const marksApi = {
  getAll: (className, subjectName) => {
    const params = new URLSearchParams();
    if (className) params.set('className', className);
    if (subjectName) params.set('subjectName', subjectName);
    const query = params.toString();
    return request(`/marks${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  saveRegister: (payload) =>
    request('/marks/register', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  getExamRenames: () => request('/marks/exam-renames', withInstituteHeaders()),

  renameExam: (payload) =>
    request('/marks/exam-renames', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),
};

export const resultApi = {
  getClasses: (filters = {}) => request(`/results/classes${toQueryString(filters)}`, withInstituteHeaders()),

  getClassStudents: (className, filters = {}) =>
    request(`/results/students${toQueryString({ ...filters, className })}`, withInstituteHeaders()),

  getClassExams: (className, filters = {}) =>
    request(`/results/exams${toQueryString({ ...filters, className })}`, withInstituteHeaders()),

  getStudentResult: (className, studentId, filters = {}) =>
    request(`/results/student${toQueryString({ ...filters, className, studentId })}`, withInstituteHeaders()),

  getMyStudentResult: (filters = {}) =>
    request(`/results/student/me${toQueryString(filters)}`, withPortalHeaders('student')),

  publish: (payload) =>
    request(`/results/publish${toQueryString(payload)}`, withInstituteHeaders({ method: 'POST' })),

  reopen: (payload) =>
    request(`/results/reopen${toQueryString(payload)}`, withInstituteHeaders({ method: 'POST' })),
};

export const reportApi = {
  getSnapshots: () => request('/reports', withInstituteHeaders()),

  getSnapshotsPage: (filters = {}) => request(`/reports/snapshots${toQueryString(filters)}`, withInstituteHeaders()),

  getOverview: (filters = {}) => request(`/reports/overview${toQueryString(filters)}`, withInstituteHeaders()),

  getCategoryBundle: (category, filters = {}) => request(`/reports/${category}/bundle${toQueryString(filters)}`, withInstituteHeaders()),

  getReport: (category, reportKey, filters = {}) => request(`/reports/${category}/${reportKey}${toQueryString(filters)}`, withInstituteHeaders()),

  exportReport: (category, reportKey, filters = {}) => request(`/reports/${category}/${reportKey}/export${toQueryString(filters)}`, withInstituteHeaders()),

  getFeeSummary: (filters = {}) => request(`/reports/fees/summary${toQueryString(filters)}`, withInstituteHeaders()),

  getFeeCollections: (filters = {}) => request(`/reports/fees/collections${toQueryString(filters)}`, withInstituteHeaders()),

  getFeeOutstanding: (filters = {}) => request(`/reports/fees/outstanding${toQueryString(filters)}`, withInstituteHeaders()),

  getSalarySummary: (filters = {}) => request(`/reports/salary/summary${toQueryString(filters)}`, withInstituteHeaders()),

  getSalaryPayments: (filters = {}) => request(`/reports/salary/payments${toQueryString(filters)}`, withInstituteHeaders()),

  getSalaryOutstanding: (filters = {}) => request(`/reports/salary/outstanding${toQueryString(filters)}`, withInstituteHeaders()),

  saveSnapshot: (payload) =>
    request('/reports', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteSnapshot: (id) =>
    request(`/reports/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const noticeApi = {
  getOverview: () => request('/notices/overview', withInstituteHeaders()),

  getAll: (filters = {}) => request(`/notices${toQueryString(filters)}`, withInstituteHeaders()),

  getById: (id) => request(`/notices/${id}`, withInstituteHeaders()),

  getPortalAll: (filters = {}) => request(`/notices/portal${toQueryString(filters)}`, withInstituteHeaders()),

  getPortalOverview: (filters = {}) => request(`/notices/portal/overview${toQueryString(filters)}`, withInstituteHeaders()),

  getPortalDetail: (id) => request(`/notices/portal/${id}`, withInstituteHeaders()),

  create: (payload) =>
    request('/notices', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  update: (id, payload) =>
    request(`/notices/${id}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  delete: (id) =>
    request(`/notices/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const holidayApi = {
  getAll: ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request(`/holidays${query ? `?${query}` : ''}`, withInstituteHeaders());
  },

  create: (payload) =>
    request('/holidays', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  update: (id, payload) =>
    request(`/holidays/${id}`, withInstituteHeaders({
      method: 'PUT',
      body: JSON.stringify(payload),
    })),

  delete: (id) =>
    request(`/holidays/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const libraryApi = {
  getOverview: () => request('/library/overview', withInstituteHeaders()),

  getBooks: (filters = {}) => request(`/library/books${toQueryString(filters)}`, withInstituteHeaders()),

  saveBook: (payload) =>
    request('/library/books', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteBook: (id) =>
    request(`/library/books/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getIssues: (filters = {}) => request(`/library/issues${toQueryString(filters)}`, withInstituteHeaders()),

  saveIssue: (payload) =>
    request('/library/issues', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteIssue: (id) =>
    request(`/library/issues/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  markReturned: (id, payload = {}) =>
    request(`/library/issues/${id}/return`, withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  searchStudents: (filters = {}) => request(`/library/students/search${toQueryString(filters)}`, withInstituteHeaders()),

  getMySummary: () => request('/library/student/me/summary', withPortalHeaders('student')),

  getMyBooks: (filters = {}) => request(`/library/student/me/books${toQueryString(filters)}`, withPortalHeaders('student')),

  getMyIssues: (filters = {}) => request(`/library/student/me/issues${toQueryString(filters)}`, withPortalHeaders('student')),
};
