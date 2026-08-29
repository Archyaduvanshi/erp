package com.erp.backend.attendance.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.attendance.dto.AttendanceMonthResponse;
import com.erp.backend.attendance.dto.AttendanceMonthStudentResponse;
import com.erp.backend.attendance.dto.AttendanceMonthTeacherResponse;
import com.erp.backend.attendance.dto.AttendanceEntryPayload;
import com.erp.backend.attendance.dto.AttendanceResponse;
import com.erp.backend.attendance.dto.AttendanceSessionEntryResponse;
import com.erp.backend.attendance.dto.AttendanceSessionResponse;
import com.erp.backend.attendance.dto.AttendanceSessionSaveRequest;
import com.erp.backend.attendance.dto.AttendanceStudentResponse;
import com.erp.backend.attendance.dto.AttendanceTargetResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceEntryPayload;
import com.erp.backend.attendance.dto.TeacherAttendanceMonthResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceMonthTeacherResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceResponse;
import com.erp.backend.attendance.dto.TeacherAttendanceSaveRequest;
import com.erp.backend.attendance.dto.TeacherAttendanceTargetResponse;
import com.erp.backend.attendance.entity.AttendanceEntry;
import com.erp.backend.attendance.entity.AttendanceSession;
import com.erp.backend.attendance.entity.TeacherAttendanceRecord;
import com.erp.backend.attendance.repository.AttendanceEntryRepository;
import com.erp.backend.attendance.repository.AttendanceSessionRepository;
import com.erp.backend.attendance.repository.TeacherAttendanceRecordRepository;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.ClassSubject;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.curriculum.repository.ClassSectionRepository;
import com.erp.backend.curriculum.repository.ClassSubjectRepository;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.dto.StudentClassSummaryResponse;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.timetable.entity.ClassTimetable;
import com.erp.backend.timetable.repository.ClassTimetableRepository;
import com.erp.backend.timetable.repository.TimetablePeriodRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AttendanceService {
    private static final int DAILY_ATTENDANCE_PERIOD_NUMBER = 1;

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final TeacherAttendanceRecordRepository teacherAttendanceRecordRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final ClassSectionRepository classSectionRepository;
    private final ClassSubjectRepository classSubjectRepository;
    private final AttendanceSessionRepository attendanceSessionRepository;
    private final AttendanceEntryRepository attendanceEntryRepository;
    private final ClassTimetableRepository classTimetableRepository;
    private final TimetablePeriodRepository timetablePeriodRepository;

    public AttendanceService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            TeacherAttendanceRecordRepository teacherAttendanceRecordRepository,
            AcademicSessionRepository academicSessionRepository,
            SchoolClassRepository schoolClassRepository,
            ClassSectionRepository classSectionRepository,
            ClassSubjectRepository classSubjectRepository,
            AttendanceSessionRepository attendanceSessionRepository,
            AttendanceEntryRepository attendanceEntryRepository,
            ClassTimetableRepository classTimetableRepository,
            TimetablePeriodRepository timetablePeriodRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.teacherAttendanceRecordRepository = teacherAttendanceRecordRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.classSectionRepository = classSectionRepository;
        this.classSubjectRepository = classSubjectRepository;
        this.attendanceSessionRepository = attendanceSessionRepository;
        this.attendanceEntryRepository = attendanceEntryRepository;
        this.classTimetableRepository = classTimetableRepository;
        this.timetablePeriodRepository = timetablePeriodRepository;
    }

    public List<AttendanceTargetResponse> getAttendanceTargets(Long instituteId, Long academicSessionId) {
        validateAcademicSession(instituteId, academicSessionId);
        Map<String, Long> studentCounts = studentRepository.findClassSummaries(instituteId)
                .stream()
                .collect(Collectors.toMap(
                        summary -> normalizeLabel(summary.assignedClass()),
                        StudentClassSummaryResponse::totalStudents,
                        Long::sum
                ));
        Map<Long, List<ClassSection>> sectionsByClassId = classSectionRepository.findAllByInstituteIdOrderBySchoolClassIdAscNameAsc(instituteId)
                .stream()
                .filter(section -> !"ARCHIVED".equalsIgnoreCase(defaultValue(section.getStatus(), "")))
                .collect(Collectors.groupingBy(section -> section.getSchoolClass().getId()));

        return schoolClassRepository.findAllByInstituteIdOrderByNameAsc(instituteId)
                .stream()
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(defaultValue(schoolClass.getStatus(), "")))
                .flatMap(schoolClass -> {
                    List<ClassSection> sections = sectionsByClassId.getOrDefault(schoolClass.getId(), List.of());
                    if (sections.isEmpty()) {
                        String displayName = "Class " + schoolClass.getName();
                        String assignedLabel = buildAssignedClassLabel(schoolClass, null);
                        return java.util.stream.Stream.of(new AttendanceTargetResponse(
                                schoolClass.getId(),
                                schoolClass.getName(),
                                null,
                                null,
                                displayName,
                                studentCounts.getOrDefault(normalizeLabel(assignedLabel), 0L)
                        ));
                    }
                    return sections.stream().map(section -> {
                        String displayName = "Class " + schoolClass.getName() + "-" + section.getName();
                        String assignedLabel = buildAssignedClassLabel(schoolClass, section);
                        return new AttendanceTargetResponse(
                                schoolClass.getId(),
                                schoolClass.getName(),
                                section.getId(),
                                section.getName(),
                                displayName,
                                studentCounts.getOrDefault(normalizeLabel(assignedLabel), 0L)
                        );
                    });
                })
                .toList();
    }

    public List<AttendanceStudentResponse> getClassStudents(Long instituteId, Long academicSessionId, Long classId, Long sectionId) {
        validateAcademicSession(instituteId, academicSessionId);
        SchoolClass schoolClass = validateClass(instituteId, classId);
        ClassSection section = validateSection(instituteId, schoolClass, sectionId);
        return studentRepository.findAttendanceStudents(instituteId, buildAssignedClassLabel(schoolClass, section));
    }

    public List<AttendanceStudentResponse> getClassStudents(AuthPrincipal principal, Long academicSessionId, Long classId, Long sectionId) {
        ensureTeacherCanAccessAttendanceTarget(principal, academicSessionId, classId, sectionId);
        return getClassStudents(principal.instituteId(), academicSessionId, classId, sectionId);
    }

    public List<TeacherAttendanceTargetResponse> getTeacherAttendanceTargets(Long instituteId, Long teacherId, Long academicSessionId) {
        validateAcademicSession(instituteId, academicSessionId);
        findTeacher(instituteId, teacherId);
        Map<String, Long> studentCounts = studentRepository.findClassSummaries(instituteId)
                .stream()
                .collect(Collectors.toMap(
                        summary -> normalizeLabel(summary.assignedClass()),
                        StudentClassSummaryResponse::totalStudents,
                        Long::sum
                ));
        return timetablePeriodRepository.findTeacherPeriodProjections(instituteId, academicSessionId, teacherId)
                .stream()
                .collect(Collectors.toMap(
                        period -> period.classId() + ":" + (period.sectionId() == null ? "none" : period.sectionId()),
                        Function.identity(),
                        (existing, ignored) -> existing,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .map(period -> {
                    String assignedLabel = period.sectionName() == null
                            ? period.className()
                            : period.className() + " / " + period.sectionName();
                    String displayName = period.sectionName() == null
                            ? "Class " + period.className()
                            : "Class " + period.className() + "-" + period.sectionName();
                    return new TeacherAttendanceTargetResponse(
                            period.classId(),
                            period.className(),
                            period.sectionId(),
                            period.sectionName(),
                            displayName,
                            studentCounts.getOrDefault(normalizeLabel(assignedLabel), 0L)
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public AttendanceSessionResponse getAttendanceSession(Long instituteId, Long academicSessionId, Long classId, Long sectionId, String date, Integer periodNumber) {
        validateAcademicSession(instituteId, academicSessionId);
        SchoolClass schoolClass = validateClass(instituteId, classId);
        validateSection(instituteId, schoolClass, sectionId);
        LocalDate attendanceDate = LocalDate.parse(date.trim());
        Integer resolvedPeriod = resolvePeriod(periodNumber);
        return attendanceSessionRepository.findLogicalSession(instituteId, academicSessionId, classId, sectionId, attendanceDate, resolvedPeriod)
                .map(session -> toSessionResponse(session, attendanceEntryRepository.findAllByAttendanceSessionId(session.getId())))
                .orElseGet(() -> new AttendanceSessionResponse(null, academicSessionId, classId, sectionId, attendanceDate.toString(), resolvedPeriod, null, null, null, null, List.of()));
    }

    @Transactional(readOnly = true)
    public AttendanceSessionResponse getAttendanceSession(AuthPrincipal principal, Long academicSessionId, Long classId, Long sectionId, String date, Integer periodNumber) {
        ensureTeacherCanAccessAttendanceTarget(principal, academicSessionId, classId, sectionId);
        return getAttendanceSession(principal.instituteId(), academicSessionId, classId, sectionId, date, periodNumber);
    }

    @Transactional
    public AttendanceSessionResponse saveAttendanceSession(Long instituteId, Long markedByUserId, AttendanceSessionSaveRequest request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession academicSession = validateAcademicSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = validateClass(instituteId, request.classId());
        ClassSection section = validateSection(instituteId, schoolClass, request.sectionId());
        LocalDate attendanceDate = LocalDate.parse(request.date().trim());
        Integer periodNumber = resolvePeriod(request.periodNumber());
        ClassSubject classSubject = validateClassSubject(instituteId, academicSession.getId(), schoolClass.getId(), request.classSubjectId());
        Teacher markedByTeacher = request.markedByTeacherId() == null ? null : findTeacher(instituteId, request.markedByTeacherId());

        Set<Long> submittedStudentIds = request.entries().stream()
                .map(AttendanceEntryPayload::studentId)
                .collect(Collectors.toSet());
        Map<Long, Student> studentsById = studentRepository.findAllByInstituteIdAndIdIn(instituteId, submittedStudentIds)
                .stream()
                .collect(Collectors.toMap(Student::getId, Function.identity()));
        String expectedAssignedClass = normalizeLabel(buildAssignedClassLabel(schoolClass, section));
        for (Long studentId : submittedStudentIds) {
            Student student = studentsById.get(studentId);
            if (student == null || !expectedAssignedClass.equals(normalizeLabel(firstNonBlank(student.getAssignedClass(), student.getClassName())))) {
                throw new IllegalArgumentException("Student " + studentId + " does not belong to the selected class/section.");
            }
        }

        AttendanceSession attendanceSession = attendanceSessionRepository
                .findLogicalSession(instituteId, academicSession.getId(), schoolClass.getId(), section == null ? null : section.getId(), attendanceDate, periodNumber)
                .orElseGet(AttendanceSession::new);
        attendanceSession.setInstitute(institute);
        attendanceSession.setAcademicSession(academicSession);
        attendanceSession.setSchoolClass(schoolClass);
        attendanceSession.setSection(section);
        attendanceSession.setAttendanceDate(attendanceDate);
        attendanceSession.setPeriodNumber(periodNumber);
        attendanceSession.setClassSubject(classSubject);
        attendanceSession.setMarkedByTeacher(markedByTeacher);
        attendanceSession.setMarkedByUserId(markedByUserId);
        attendanceSession = attendanceSessionRepository.save(attendanceSession);

        attendanceEntryRepository.deleteAllByAttendanceSessionId(attendanceSession.getId());
        AttendanceSession savedSession = attendanceSession;
        List<AttendanceEntry> entries = request.entries().stream()
                .map(entry -> {
                    AttendanceEntry attendanceEntry = new AttendanceEntry();
                    attendanceEntry.setAttendanceSession(savedSession);
                    attendanceEntry.setStudent(studentsById.get(entry.studentId()));
                    attendanceEntry.setStatus(normalizeStatus(entry.status()));
                    return attendanceEntry;
                })
                .toList();
        List<AttendanceEntry> savedEntries = attendanceEntryRepository.saveAll(entries);
        return toSessionResponse(attendanceSession, savedEntries);
    }

    @Transactional
    public AttendanceSessionResponse saveAttendanceSession(AuthPrincipal principal, AttendanceSessionSaveRequest request) {
        if ("TEACHER".equalsIgnoreCase(principal.role())) {
            ensureTeacherCanAccessAttendanceTarget(principal, request.academicSessionId(), request.classId(), request.sectionId());
            request = new AttendanceSessionSaveRequest(
                    request.academicSessionId(),
                    request.classId(),
                    request.sectionId(),
                    request.date(),
                    request.periodNumber(),
                    request.classSubjectId(),
                    principal.teacherId(),
                    request.entries()
            );
        }
        return saveAttendanceSession(principal.instituteId(), principal.accountId(), request);
    }

    @Transactional(readOnly = true)
    public AttendanceMonthResponse getMonthlyAttendance(Long instituteId, Long academicSessionId, Long classId, Long sectionId, String month, Long teacherId) {
        validateAcademicSession(instituteId, academicSessionId);
        SchoolClass schoolClass = validateClass(instituteId, classId);
        ClassSection section = validateSection(instituteId, schoolClass, sectionId);
        if (teacherId != null) {
            findTeacher(instituteId, teacherId);
        }
        YearMonth yearMonth = YearMonth.parse(month.trim());
        List<AttendanceStudentResponse> students = studentRepository.findAttendanceStudents(instituteId, buildAssignedClassLabel(schoolClass, section));
        List<AttendanceSession> allSessions = attendanceSessionRepository.findMonthSessions(instituteId, academicSessionId, classId, sectionId, yearMonth.atDay(1), yearMonth.atEndOfMonth());
        Teacher attendanceTeacher = findClassAttendanceTeacher(instituteId, academicSessionId, classId, sectionId);
        List<AttendanceMonthTeacherResponse> teachers = allSessions.stream()
                .map(AttendanceSession::getMarkedByTeacher)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toMap(
                        Teacher::getId,
                        teacher -> new AttendanceMonthTeacherResponse(teacher.getId(), buildTeacherName(teacher), teacher.getEmployeeId()),
                        (existing, ignored) -> existing,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .toList();
        if (attendanceTeacher != null && teachers.stream().noneMatch(teacher -> teacher.teacherId().equals(attendanceTeacher.getId()))) {
            teachers = java.util.stream.Stream.concat(
                    java.util.stream.Stream.of(new AttendanceMonthTeacherResponse(attendanceTeacher.getId(), buildTeacherName(attendanceTeacher), attendanceTeacher.getEmployeeId())),
                    teachers.stream()
            ).toList();
        }
        List<AttendanceSession> sessions = allSessions;
        if (teacherId != null) {
            List<AttendanceSession> teacherSessions = allSessions.stream()
                    .filter(session -> wasMarkedByTeacher(session, teacherId))
                    .toList();
            if (!teacherSessions.isEmpty()) {
                sessions = teacherSessions;
            }
        }
        Map<Long, AttendanceSession> sessionsById = sessions.stream().collect(Collectors.toMap(AttendanceSession::getId, Function.identity()));
        Map<Long, Map<String, String>> statusByStudent = new LinkedHashMap<>();
        attendanceEntryRepository.findAllByAttendanceSessionIdIn(sessionsById.keySet()).forEach(entry -> {
            AttendanceSession session = sessionsById.get(entry.getAttendanceSession().getId());
            if (session == null) return;
            statusByStudent
                    .computeIfAbsent(entry.getStudent().getId(), ignored -> new LinkedHashMap<>())
                    .put(session.getAttendanceDate().toString(), entry.getStatus());
        });
        return new AttendanceMonthResponse(
                classId,
                sectionId,
                yearMonth.toString(),
                attendanceTeacher == null ? null : attendanceTeacher.getId(),
                attendanceTeacher == null ? null : buildTeacherName(attendanceTeacher),
                attendanceTeacher == null ? null : attendanceTeacher.getEmployeeId(),
                teachers,
                students.stream()
                        .map(student -> new AttendanceMonthStudentResponse(
                                student.studentId(),
                                student.name(),
                                student.rollNo(),
                                statusByStudent.getOrDefault(student.studentId(), Map.of())
                        ))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> getStudentAttendanceMonth(Long instituteId, Long studentId, String month) {
        Student student = studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
        YearMonth yearMonth = YearMonth.parse(month.trim());
        return attendanceEntryRepository.findStudentMonthEntries(instituteId, studentId, yearMonth.atDay(1), yearMonth.atEndOfMonth())
                .stream()
                .map(entry -> toStudentPortalResponse(entry, student))
                .toList();
    }

    private Teacher findClassAttendanceTeacher(Long instituteId, Long academicSessionId, Long classId, Long sectionId) {
        return (sectionId == null
                ? classTimetableRepository.findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionIsNull(instituteId, academicSessionId, classId)
                : classTimetableRepository.findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionId(instituteId, academicSessionId, classId, sectionId))
                .map(ClassTimetable::getAttendanceTeacher)
                .orElse(null);
    }

    public List<TeacherAttendanceResponse> getTeacherAttendanceForDate(Long instituteId, String date) {
        validateInstitute(instituteId);
        LocalDate attendanceDate = LocalDate.parse(date.trim());
        return teacherAttendanceRecordRepository.findAllByInstituteIdAndAttendanceDate(instituteId, attendanceDate)
                .stream()
                .map(this::toTeacherAttendanceResponse)
                .toList();
    }

    public TeacherAttendanceMonthResponse getTeacherAttendanceForMonth(Long instituteId, String month) {
        validateInstitute(instituteId);
        YearMonth yearMonth = YearMonth.parse(month.trim());
        List<TeacherAttendanceRecord> records = teacherAttendanceRecordRepository
                .findAllByInstituteIdAndAttendanceDateBetween(instituteId, yearMonth.atDay(1), yearMonth.atEndOfMonth());
        Map<Long, TeacherAttendanceMonthTeacherResponse> teachers = new LinkedHashMap<>();
        Map<Long, Map<String, String>> daysByTeacher = new LinkedHashMap<>();
        records.forEach(record -> {
            Teacher teacher = record.getTeacher();
            teachers.putIfAbsent(teacher.getId(), new TeacherAttendanceMonthTeacherResponse(
                    teacher.getId(),
                    buildTeacherName(teacher),
                    teacher.getEmployeeId(),
                    teacher.getSpecialization(),
                    Map.of()
            ));
            daysByTeacher.computeIfAbsent(teacher.getId(), ignored -> new LinkedHashMap<>())
                    .put(record.getAttendanceDate().toString(), defaultValue(record.getStatus(), "Present"));
        });
        return new TeacherAttendanceMonthResponse(
                yearMonth.toString(),
                teachers.values().stream()
                        .map(teacher -> new TeacherAttendanceMonthTeacherResponse(
                                teacher.teacherId(),
                                teacher.teacherName(),
                                teacher.employeeId(),
                                teacher.specialization(),
                                daysByTeacher.getOrDefault(teacher.teacherId(), Map.of())
                        ))
                        .toList()
        );
    }

    @Transactional
    public List<TeacherAttendanceResponse> saveTeacherAttendance(Long instituteId, Long markedByUserId, TeacherAttendanceSaveRequest request) {
        Institute institute = validateInstitute(instituteId);
        LocalDate attendanceDate = LocalDate.parse(request.date().trim());
        String markedBy = request.markedBy().trim();

        List<TeacherAttendanceRecord> existing = teacherAttendanceRecordRepository
                .findAllByInstituteIdAndAttendanceDate(instituteId, attendanceDate);
        teacherAttendanceRecordRepository.deleteAll(existing);

        Set<Long> teacherIds = request.entries().stream()
                .map(TeacherAttendanceEntryPayload::teacherId)
                .collect(Collectors.toSet());
        Map<Long, Teacher> teachersById = teacherRepository.findAllByInstituteIdAndIdIn(instituteId, teacherIds)
                .stream()
                .collect(Collectors.toMap(Teacher::getId, Function.identity()));
        if (teachersById.size() != teacherIds.size()) {
            throw new IllegalArgumentException("One or more teachers do not belong to this institute.");
        }

        List<TeacherAttendanceRecord> records = request.entries().stream()
                .map(entry -> createTeacherAttendanceRecord(institute, attendanceDate, markedBy, markedByUserId, entry, teachersById))
                .toList();

        return teacherAttendanceRecordRepository.saveAll(records)
                .stream()
                .map(this::toTeacherAttendanceResponse)
                .toList();
    }

    private AttendanceResponse toStudentPortalResponse(AttendanceEntry entry, Student student) {
        AttendanceSession session = entry.getAttendanceSession();
        ClassSubject classSubject = session.getClassSubject();
        Teacher teacher = session.getMarkedByTeacher();
        return new AttendanceResponse(
                entry.getId(),
                session.getAttendanceDate() == null ? null : session.getAttendanceDate().toString(),
                String.valueOf(session.getPeriodNumber()),
                classSubject == null ? "Daily Attendance" : classSubject.getSubject().getName(),
                teacher == null ? "Teacher" : buildTeacherName(teacher),
                buildAssignedClassLabel(session.getSchoolClass(), session.getSection()),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(student.getRollNo(), student.getEnrollmentNo()),
                defaultValue(entry.getStatus(), "Present"),
                entry.getCreatedAt(),
                entry.getUpdatedAt()
        );
    }

    private TeacherAttendanceRecord createTeacherAttendanceRecord(
            Institute institute,
            LocalDate attendanceDate,
            String markedBy,
            Long markedByUserId,
            TeacherAttendanceEntryPayload entry,
            Map<Long, Teacher> teachersById
    ) {
        Teacher teacher = teachersById.get(entry.teacherId());
        TeacherAttendanceRecord record = new TeacherAttendanceRecord();
        record.setInstitute(institute);
        record.setTeacher(teacher);
        record.setAttendanceDate(attendanceDate);
        record.setStatus(defaultValue(entry.status(), "Present"));
        record.setMarkedBy(markedBy);
        record.setMarkedByUserId(markedByUserId);
        return record;
    }

    private TeacherAttendanceResponse toTeacherAttendanceResponse(TeacherAttendanceRecord record) {
        Teacher teacher = record.getTeacher();
        return new TeacherAttendanceResponse(
                record.getId(),
                teacher.getId(),
                buildTeacherName(teacher),
                teacher.getEmployeeId(),
                teacher.getSpecialization(),
                record.getAttendanceDate() == null ? null : record.getAttendanceDate().toString(),
                defaultValue(record.getStatus(), "Present"),
                record.getMarkedBy(),
                record.getMarkedByUserId(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private AcademicSession validateAcademicSession(Long instituteId, Long academicSessionId) {
        return academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Academic session not found with id: " + academicSessionId));
    }

    private SchoolClass validateClass(Long instituteId, Long classId) {
        return schoolClassRepository.findByInstituteIdAndId(instituteId, classId)
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(defaultValue(schoolClass.getStatus(), "")))
                .orElseThrow(() -> new ResourceNotFoundException("Class not found with id: " + classId));
    }

    private ClassSection validateSection(Long instituteId, SchoolClass schoolClass, Long sectionId) {
        if (sectionId == null) return null;
        return classSectionRepository.findByInstituteIdAndId(instituteId, sectionId)
                .filter(section -> section.getSchoolClass().getId().equals(schoolClass.getId()))
                .filter(section -> !"ARCHIVED".equalsIgnoreCase(defaultValue(section.getStatus(), "")))
                .orElseThrow(() -> new ResourceNotFoundException("Section not found with id: " + sectionId));
    }

    private ClassSubject validateClassSubject(Long instituteId, Long academicSessionId, Long classId, Long classSubjectId) {
        if (classSubjectId == null) return null;
        return classSubjectRepository.findByInstituteIdAndId(instituteId, classSubjectId)
                .filter(subject -> subject.getAcademicSession().getId().equals(academicSessionId))
                .filter(subject -> subject.getSchoolClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException("Class subject not found with id: " + classSubjectId));
    }

    private AttendanceSessionResponse toSessionResponse(AttendanceSession session, List<AttendanceEntry> entries) {
        Teacher teacher = session.getMarkedByTeacher();
        ClassSubject classSubject = session.getClassSubject();
        return new AttendanceSessionResponse(
                session.getId(),
                session.getAcademicSession().getId(),
                session.getSchoolClass().getId(),
                session.getSection() == null ? null : session.getSection().getId(),
                session.getAttendanceDate().toString(),
                session.getPeriodNumber(),
                classSubject == null ? null : classSubject.getId(),
                classSubject == null ? null : classSubject.getSubject().getName(),
                teacher == null ? null : teacher.getId(),
                teacher == null ? null : buildTeacherName(teacher),
                entries.stream()
                        .map(entry -> new AttendanceSessionEntryResponse(entry.getStudent().getId(), entry.getStatus()))
                        .toList()
        );
    }

    private boolean wasMarkedByTeacher(AttendanceSession session, Long teacherId) {
        if (teacherId == null) return true;
        Teacher markedByTeacher = session.getMarkedByTeacher();
        if (markedByTeacher != null && teacherId.equals(markedByTeacher.getId())) {
            return true;
        }
        return teacherId.equals(session.getMarkedByUserId());
    }

    private String buildAssignedClassLabel(SchoolClass schoolClass, ClassSection section) {
        return section == null ? schoolClass.getName() : schoolClass.getName() + " / " + section.getName();
    }

    private String normalizeLabel(String value) {
        return String.valueOf(value == null ? "" : value).trim().replaceAll("\\s+", " ").toLowerCase();
    }

    private Integer resolvePeriod(Integer periodNumber) {
        return periodNumber == null || periodNumber < 1 ? DAILY_ATTENDANCE_PERIOD_NUMBER : periodNumber;
    }

    private String normalizeStatus(String status) {
        String normalized = defaultValue(status, "Present").trim().toUpperCase();
        return switch (normalized) {
            case "P", "PRESENT" -> "Present";
            case "A", "ABSENT" -> "Absent";
            case "LEAVE" -> "Leave";
            case "LATE" -> "Late";
            default -> throw new IllegalArgumentException("Unsupported attendance status: " + status);
        };
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private Teacher findTeacher(Long instituteId, Long teacherId) {
        return teacherRepository.findByInstituteIdAndId(instituteId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherId));
    }

    private void ensureTeacherCanAccessAttendanceTarget(AuthPrincipal principal, Long academicSessionId, Long classId, Long sectionId) {
        if (!"TEACHER".equalsIgnoreCase(principal.role())) {
            return;
        }
        if (principal.teacherId() == null) {
            throw new AccessDeniedException("Teacher account is not linked to a teacher.");
        }
        boolean assigned = timetablePeriodRepository
                .findTeacherPeriodProjections(principal.instituteId(), academicSessionId, principal.teacherId())
                .stream()
                .anyMatch(period -> Objects.equals(period.classId(), classId)
                        && Objects.equals(period.sectionId(), sectionId));
        if (!assigned) {
            throw new AccessDeniedException("Teacher is not assigned to this class/section.");
        }
    }

    private String buildStudentName(Student student) {
        return String.join(" ",
                defaultValue(student.getFirstName(), "").trim(),
                defaultValue(student.getLastName(), "").trim()).trim();
    }

    private String buildTeacherName(Teacher teacher) {
        String fullName = String.join(" ",
                defaultValue(teacher.getFirstName(), "").trim(),
                defaultValue(teacher.getLastName(), "").trim()).trim();
        return StringUtils.hasText(fullName) ? fullName : defaultValue(teacher.getName(), "Teacher");
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }
}
