import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
} from 'lucide-react';
import { timetableApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const StudentTimetable = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [classTimetableRecord, setClassTimetableRecord] = useState(null);
  const [loadError, setLoadError] = useState('');

  const studentVisibleTimetableRecord = useMemo(() => (
    buildStudentVisibleTimetableRecord(classTimetableRecord)
  ), [classTimetableRecord]);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const timetableResponse = await timetableApi.getMyStudentTimetable();
        setClassTimetableRecord(timetableResponse);
        setLoadError('');
      } catch (error) {
        setClassTimetableRecord(null);
        setLoadError(error.message || 'Unable to load your timetable.');
      }
    };

    if (session?.role === 'student' && session?.studentId) {
      loadData();
    }
  }, [session]);

  const handleDownload = (record) => {
    if (!record?.fileData) return;
    const link = document.createElement('a');
    link.href = record.fileData;
    link.download = record.fileName || 'class-timetable';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7ff_46%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-600">Student Timetable</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Class Timetable</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}
        <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Assigned Class Timetable</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Only timetable for {classTimetableRecord?.className || 'your class'} is visible here.
              </p>
            </div>
          </div>

          {studentVisibleTimetableRecord ? (
            <article className="mt-8 rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
                    Class {studentVisibleTimetableRecord.className || 'pending'}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Uploaded {formatDateTime(studentVisibleTimetableRecord.uploadedAt || studentVisibleTimetableRecord.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(studentVisibleTimetableRecord)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>

              {!isPreviewableFile(studentVisibleTimetableRecord) ? (
                <div className="mt-5 rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-5 text-sm leading-7 text-slate-500">
                  Ye file browser ke andar preview nahi hoti. Student isse sirf download/open kar sakta hai.
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
                  {isImageFile(studentVisibleTimetableRecord) ? (
                    <img
                      src={studentVisibleTimetableRecord.fileData}
                      alt={studentVisibleTimetableRecord.fileName || 'Uploaded timetable'}
                      className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
                    />
                  ) : (
                    <iframe
                      title={studentVisibleTimetableRecord.fileName || 'Uploaded timetable'}
                      src={studentVisibleTimetableRecord.fileData}
                      className="h-[78vh] w-full bg-white"
                    />
                  )}
                </div>
              )}
            </article>
          ) : (
            <EmptyState
              title="No timetable uploaded"
              description="College ne abhi tak aapki class ka timetable upload nahi kiya hai. Upload hote hi yahan read-only view me dikh jayega."
            />
          )}
        </section>
      </main>
    </div>
  );
};

const EmptyState = ({ title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <FileText size={34} />
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const formatDateTime = (value) => {
  if (!value) return 'Date pending';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildStudentVisibleTimetableRecord = (record) => {
  if (!record) return null;

  if (record?.templateData?.rows?.length && record?.templateData?.lecturePlan?.length) {
    return {
      ...record,
      fileType: 'text/html',
      fileData: buildStudentVisibleHtmlDataUri(record.templateData, record.className),
    };
  }

  if (record?.fileType === 'text/html' && typeof window !== 'undefined') {
    const sanitizedHtml = sanitizeTeacherIdsFromHtml(record.fileData);
    if (sanitizedHtml) {
      return {
        ...record,
        fileData: sanitizedHtml,
      };
    }
  }

  return record;
};

const buildStudentVisibleHtmlDataUri = (templateData, className) => {
  const safeTemplate = normalizeStudentTimetableTemplate(templateData, className);
  if (!safeTemplate) return '';

  const html = buildStudentVisibleTimetableHtml(safeTemplate);
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

const normalizeStudentTimetableTemplate = (templateData, fallbackClassName) => {
  if (!templateData?.rows?.length || !templateData?.lecturePlan?.length) return null;

  return {
    schoolName: String(templateData.schoolName || '').trim() || 'School Name',
    className: String(templateData.className || fallbackClassName || '').trim() || 'Class',
    lecturePlan: templateData.lecturePlan,
    rows: templateData.rows.map((row) => ({
      day: String(row.day || '').trim(),
      slots: (row.slots || []).map((slot) => ({
        subjectName: String(slot.subjectName || '').trim(),
        teacherName: getTeacherDisplayName(slot.teacherName),
      })),
    })),
  };
};

const getTeacherDisplayName = (value) => String(value || '').trim().replace(/\s*\([^)]*\)\s*$/, '');

const buildStudentVisibleTimetableHtml = ({ schoolName, className, lecturePlan, rows }) => {
  const displayColumns = buildStudentDisplayColumns(lecturePlan);
  const lectureHeaderCells = displayColumns.map((column) => {
    if (column.type === 'lunch') {
      return `<th style="border:1px solid #0f172a;background:#fde68a;color:#78350f;padding:9px 6px;font-size:11px;font-weight:700;text-align:center;min-width:72px;">Lunch</th>`;
    }

    return `<th style="border:1px solid #0f172a;background:#d1fae5;color:#0f172a;padding:9px 6px;font-size:11px;font-weight:700;text-align:center;min-width:130px;">Lecture ${column.lecture.lectureNumber}<br /><span style="font-size:10px;font-weight:600;">${escapeStudentTemplateHtml(column.lecture.timeFrom)} - ${escapeStudentTemplateHtml(column.lecture.timeTo)}</span></th>`;
  }).join('');

  const tableRows = studentTemplateDays.map((day, dayIndex) => `
      <tr>
        <td style="border:1px solid #0f172a;background:#f8fafc;padding:8px 6px;font-size:11px;font-weight:700;">${escapeStudentTemplateHtml(day)}</td>
        ${displayColumns.map((column) => {
          if (column.type === 'lunch') {
            if (dayIndex !== 0) return '';
            return `
          <td rowspan="${studentTemplateDays.length}" style="border:1px solid #0f172a;background:#fef3c7;padding:7px 6px;vertical-align:middle;min-width:72px;text-align:center;font-size:11px;font-weight:700;color:#78350f;">
            <div style="display:flex;align-items:center;justify-content:center;min-height:100%;padding:8px 0;">
              <span style="writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:0.18em;text-transform:uppercase;">Lunch</span>
            </div>
          </td>`;
          }

          const slot = rows[dayIndex]?.slots?.[column.lectureIndex] || { subjectName: '', teacherName: '' };
          return `
          <td style="border:1px solid #0f172a;padding:7px 6px;vertical-align:top;min-width:130px;height:52px;">
            <div style="margin:0 0 6px 0;font-size:11px;color:#0f172a;"><strong>S:</strong> ${escapeStudentTemplateHtml(slot.subjectName)}</div>
            <div style="font-size:11px;color:#0f172a;"><strong>T:</strong> ${escapeStudentTemplateHtml(slot.teacherName)}</div>
          </td>`;
        }).join('')}
      </tr>`).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <meta name="ProgId" content="Excel.Sheet" />
      </head>
      <body>
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Arial,sans-serif;min-width:${110 + (displayColumns.length * 136)}px;">
          <tr>
            <th colspan="${1 + displayColumns.length}" style="border:1px solid #0f172a;background:#0f766e;color:#ffffff;padding:10px 8px;font-size:16px;font-weight:700;text-align:center;">
              ${escapeStudentTemplateHtml(schoolName)}
            </th>
          </tr>
          <tr>
            <th style="border:1px solid #0f172a;background:#0f172a;color:#ffffff;padding:9px 6px;font-size:11px;font-weight:700;text-align:center;">Day</th>
            ${lectureHeaderCells}
          </tr>
          ${tableRows}
        </table>
        <p style="margin-top:10px;font-size:10px;color:#64748b;">Class ${escapeStudentTemplateHtml(className)}</p>
      </body>
    </html>`;
};

const buildStudentDisplayColumns = (lecturePlan = []) => {
  const columns = [];

  lecturePlan.forEach((lecture, index) => {
    columns.push({
      key: `lecture-${lecture.lectureNumber}`,
      type: 'lecture',
      lecture,
      lectureIndex: index,
    });

    if (lecture.lectureNumber === 4 && index < lecturePlan.length - 1) {
      columns.push({
        key: 'lunch-after-4',
        type: 'lunch',
      });
    }
  });

  return columns;
};

const sanitizeTeacherIdsFromHtml = (dataUri) => {
  const html = decodeStudentHtmlDataUri(dataUri);
  if (!html || typeof window === 'undefined') return '';

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');
  const cells = Array.from(documentNode.querySelectorAll('td, div'));

  cells.forEach((node) => {
    const text = String(node.textContent || '');
    if (!/\bT:\s*/.test(text)) return;
    node.textContent = text.replace(/(\bT:\s*)(.*)/, (_, prefix, teacherValue) => `${prefix}${getTeacherDisplayName(teacherValue)}`);
  });

  return `data:text/html;charset=utf-8,${encodeURIComponent(documentNode.documentElement.outerHTML)}`;
};

const decodeStudentHtmlDataUri = (dataUri) => {
  const prefix = 'data:text/html;charset=utf-8,';
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith(prefix)) return '';

  try {
    return decodeURIComponent(dataUri.slice(prefix.length));
  } catch {
    return '';
  }
};

const escapeStudentTemplateHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const studentTemplateDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isImageFile = (record) => {
  return record.fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(record.fileName || '');
};

const isPdfFile = (record) => {
  return record.fileType === 'application/pdf' || /\.pdf$/i.test(record.fileName || '');
};

const isHtmlFile = (record) => {
  return record.fileType === 'text/html' || /\.(html?)$/i.test(record.fileName || '');
};

const isPreviewableFile = (record) => {
  return Boolean(record?.fileData) && (isImageFile(record) || isPdfFile(record) || isHtmlFile(record));
};

export default StudentTimetable;
