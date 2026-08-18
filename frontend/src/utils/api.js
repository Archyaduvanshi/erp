const resolveApiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080/api';
  const trimmedUrl = configuredUrl.replace(/\/+$/, '');

  return trimmedUrl.endsWith('/api') ? trimmedUrl : `${trimmedUrl}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();

const getInstituteId = () => localStorage.getItem('current_college_id');

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

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

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

  featureLogin: (payload) =>
    request('/settings/feature-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reset: () =>
    request('/settings', withInstituteHeaders({
      method: 'DELETE',
    })),
};

const withInstituteHeaders = (options = {}) => {
  const instituteId = getInstituteId();
  if (!instituteId) {
    throw new Error('College session expired. Please log in again.');
  }

  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-Institute-Id': instituteId,
    },
  };
};

export const studentApi = {
  login: (payload) =>
    request('/students/portal-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAll: () => request('/students', withInstituteHeaders()),

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
  login: (payload) =>
    request('/teachers/portal-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAll: () => request('/teachers', withInstituteHeaders()),

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
  getDrivers: () => request('/transport/drivers', withInstituteHeaders()),

  createDriver: (payload) =>
    request('/transport/drivers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteDriver: (id) =>
    request(`/transport/drivers/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getAssignments: () => request('/transport/assignments', withInstituteHeaders()),

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

  getRooms: () => request('/hostel/rooms', withInstituteHeaders()),

  saveRoom: (payload) =>
    request('/hostel/rooms', withInstituteHeaders({
      method: 'POST',
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

  getResidents: () => request('/hostel/residents', withInstituteHeaders()),

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

export const feeApi = {
  getClasses: () => request('/fees/classes', withInstituteHeaders()),

  getStructures: () => request('/fees/structures', withInstituteHeaders()),

  saveStructure: (payload) =>
    request('/fees/structures', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteStructure: (id) =>
    request(`/fees/structures/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getPayments: (studentId) =>
    request(`/fees/payments${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`, withInstituteHeaders()),

  savePayment: (payload) =>
    request('/fees/payments', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deletePayment: (id) =>
    request(`/fees/payments/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const timetableApi = {
  getClassTimetables: () => request('/timetables/classes', withInstituteHeaders()),

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

  saveTemplateDraft: (payload) =>
    request('/timetables/template-drafts', withInstituteHeaders({
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
};

export const examApi = {
  getDateSheets: () => request('/examinations/date-sheets', withInstituteHeaders()),

  saveDateSheet: (payload) =>
    request('/examinations/date-sheets', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteDateSheet: (id) =>
    request(`/examinations/date-sheets/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getQuestionPapers: () => request('/examinations/question-papers', withInstituteHeaders()),

  saveQuestionPaper: (payload) =>
    request('/examinations/question-papers', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteQuestionPaper: (id) =>
    request(`/examinations/question-papers/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getAdmitCards: () => request('/examinations/admit-cards', withInstituteHeaders()),

  saveAdmitCard: (payload) =>
    request('/examinations/admit-cards', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteAdmitCard: (id) =>
    request(`/examinations/admit-cards/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const attendanceApi = {
  getAll: (className) =>
    request(`/attendance${className ? `?className=${encodeURIComponent(className)}` : ''}`, withInstituteHeaders()),

  saveSession: (payload) =>
    request('/attendance', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteRecord: (id) =>
    request(`/attendance/${id}`, withInstituteHeaders({
      method: 'DELETE',
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

export const noticeApi = {
  getAll: () => request('/notices', withInstituteHeaders()),

  getPortalAll: () => request('/notices/portal', withInstituteHeaders()),

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
  getAll: () => request('/holidays', withInstituteHeaders()),

  create: (payload) =>
    request('/holidays', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  delete: (id) =>
    request(`/holidays/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),
};

export const libraryApi = {
  getBooks: () => request('/library/books', withInstituteHeaders()),

  saveBook: (payload) =>
    request('/library/books', withInstituteHeaders({
      method: 'POST',
      body: JSON.stringify(payload),
    })),

  deleteBook: (id) =>
    request(`/library/books/${id}`, withInstituteHeaders({
      method: 'DELETE',
    })),

  getIssues: () => request('/library/issues', withInstituteHeaders()),

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
};
