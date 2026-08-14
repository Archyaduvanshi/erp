const today = getLocalDateKey();

export function getNoticeLiveStatus(notice) {
  if (notice.status === 'Archived') return 'Archived';
  if (notice.status === 'Draft') return 'Draft';
  if (notice.publishDate && notice.publishDate > today) return 'Scheduled';
  if (notice.expireDate && notice.expireDate < today) return 'Expired';
  return 'Published';
}

export function getPortalNotices(notices, role, studentClass = '', holidays = [], studentId = '') {
  const targetAudience = role === 'teacher' ? 'Teachers' : 'Students';
  const normalizedStudentClass = normalizeNoticeClass(studentClass);
  const normalizedStudentId = String(studentId || '');

  return [
    ...(Array.isArray(notices) ? notices : []),
    ...getHolidayPortalNotices(holidays),
  ]
    .map((notice) => ({
      ...notice,
      liveStatus: getNoticeLiveStatus(notice),
    }))
    .filter((notice) => {
      if (notice.liveStatus !== 'Published') return false;
      if (notice.audience !== 'All' && notice.audience !== targetAudience) return false;
      if (notice.targetStudentId && String(notice.targetStudentId) !== normalizedStudentId) return false;
      if (targetAudience !== 'Students' || notice.audience === 'All') return true;

      const targetClasses = normalizeTargetClasses(notice.targetClasses);
      return targetClasses.includes('all') || targetClasses.includes(normalizedStudentClass);
    })
    .sort((a, b) => {
      const dateA = getNoticeSortTime(a);
      const dateB = getNoticeSortTime(b);
      if (dateA !== dateB) return dateB - dateA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
}

export function normalizeTargetClasses(value) {
  if (!value) return ['all'];
  if (Array.isArray(value)) {
    const classes = value.map(normalizeNoticeClass).filter(Boolean);
    return classes.length ? classes : ['all'];
  }
  const classes = String(value).split(',').map(normalizeNoticeClass).filter(Boolean);
  return classes.length ? classes : ['all'];
}

export function holidayAppliesToStudentClass(holiday, studentClass = '') {
  if (holiday?.audience === 'Teachers') return false;
  if (holiday?.audience === 'All') return true;

  const targetClasses = normalizeTargetClasses(holiday?.targetClasses);
  return targetClasses.includes('all') || targetClasses.includes(normalizeNoticeClass(studentClass));
}

function getHolidayPortalNotices(holidays = []) {
  if (!Array.isArray(holidays)) return [];

  return holidays.map((holiday) => {
    const holidayDate = holiday.holidayDate || '';
    const audience = normalizeNoticeAudience(holiday.audience);
    const targetClasses = audience === 'Students' ? normalizeTargetClasses(holiday.targetClasses) : ['All'];
    const publishDate = toDateOnly(holiday.createdAt) || today;
    const type = holiday.holidayType || 'Holiday';
    const notes = holiday.notes ? `\n\nNotes: ${holiday.notes}` : '';

    return {
      id: `holiday-${holiday.id || holidayDate || holiday.title}`,
      title: `Holiday: ${holiday.title || 'College Holiday'}`,
      category: 'Holiday',
      audience,
      targetClasses,
      priority: 'Normal',
      publishDate,
      expireDate: null,
      status: 'Published',
      isPinned: false,
      summary: `${holiday.title || 'A holiday'} has been added to the college holiday calendar.`,
      details: `The college has declared ${holiday.title || 'a holiday'} on ${formatNoticeDate(holidayDate)}.\n\nType: ${type}\nAudience: ${audience}${audience === 'Students' ? `\nClasses: ${targetClasses.join(', ')}` : ''}${notes}`,
      sourceType: 'HOLIDAY',
      sourceId: holiday.id,
      createdAt: holiday.createdAt,
      updatedAt: holiday.updatedAt,
    };
  });
}

function normalizeNoticeAudience(value) {
  if (value === 'Teachers' || value === 'Teacher') return 'Teachers';
  if (value === 'Students' || value === 'Student') return 'Students';
  return 'All';
}

function toDateOnly(value) {
  return String(value || '').split('T')[0] || '';
}

function getNoticeSortTime(notice) {
  const dateValue = notice.updatedAt || notice.createdAt || notice.publishDate || 0;
  const parsedTime = new Date(dateValue).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

function normalizeNoticeClass(value) {
  return String(value || '').split('/')[0]?.trim().toLowerCase() || '';
}

export function formatNoticeDate(value) {
  if (!value) return '-';
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
