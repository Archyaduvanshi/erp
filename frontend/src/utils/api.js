const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const getInstituteId = () => localStorage.getItem('current_college_id');

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

    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
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
};

const withInstituteHeaders = (options = {}) => {
  const instituteId = getInstituteId();
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(instituteId ? { 'X-Institute-Id': instituteId } : {}),
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

  delete: (id) =>
    request(`/course-books/${id}`, withInstituteHeaders({
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
