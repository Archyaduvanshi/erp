package com.erp.backend.marks.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.entity.Subject;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.curriculum.repository.SubjectRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.marks.dto.StudentMarkEntryPayload;
import com.erp.backend.marks.dto.StudentMarkResponse;
import com.erp.backend.marks.dto.StudentMarksExamPayload;
import com.erp.backend.marks.dto.StudentMarksExamRenamePayload;
import com.erp.backend.marks.dto.StudentMarksExamRenameResponse;
import com.erp.backend.marks.dto.StudentMarksRegisterPayload;
import com.erp.backend.marks.entity.ExamDefinition;
import com.erp.backend.marks.entity.MarksRegister;
import com.erp.backend.marks.entity.StudentMark;
import com.erp.backend.marks.entity.StudentMarksExamRename;
import com.erp.backend.marks.repository.ExamDefinitionRepository;
import com.erp.backend.marks.repository.MarksRegisterRepository;
import com.erp.backend.marks.repository.ResultPublicationRepository;
import com.erp.backend.marks.repository.StudentMarkRepository;
import com.erp.backend.marks.repository.StudentMarksExamRenameRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.timetable.repository.TimetablePeriodRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class StudentMarksService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final StudentMarkRepository studentMarkRepository;
    private final StudentMarksExamRenameRepository examRenameRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final SubjectRepository subjectRepository;
    private final ExamDefinitionRepository examDefinitionRepository;
    private final MarksRegisterRepository marksRegisterRepository;
    private final ResultPublicationRepository resultPublicationRepository;
    private final TimetablePeriodRepository timetablePeriodRepository;

    public StudentMarksService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            StudentMarkRepository studentMarkRepository,
            StudentMarksExamRenameRepository examRenameRepository,
            AcademicSessionRepository academicSessionRepository,
            SchoolClassRepository schoolClassRepository,
            SubjectRepository subjectRepository,
            ExamDefinitionRepository examDefinitionRepository,
            MarksRegisterRepository marksRegisterRepository,
            ResultPublicationRepository resultPublicationRepository,
            TimetablePeriodRepository timetablePeriodRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.studentMarkRepository = studentMarkRepository;
        this.examRenameRepository = examRenameRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.subjectRepository = subjectRepository;
        this.examDefinitionRepository = examDefinitionRepository;
        this.marksRegisterRepository = marksRegisterRepository;
        this.resultPublicationRepository = resultPublicationRepository;
        this.timetablePeriodRepository = timetablePeriodRepository;
    }

    public List<StudentMarkResponse> getMarks(Long instituteId, String className, String subjectName) {
        validateInstitute(instituteId);
        List<StudentMark> records = StringUtils.hasText(className) && StringUtils.hasText(subjectName)
                ? studentMarkRepository.findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseOrderByExamTitleAscCreatedAtAsc(
                        instituteId,
                        className.trim(),
                        subjectName.trim()
                )
                : studentMarkRepository.findAllByInstituteIdOrderByClassNameAscSubjectNameAscExamTitleAscCreatedAtAsc(instituteId);

        return records.stream()
                .sorted(Comparator.comparing(StudentMark::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(StudentMark::getSubjectName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(StudentMark::getExamTitle, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(record -> buildStudentName(record.getStudent()), Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toMarkResponse)
                .toList();
    }

    public List<StudentMarksExamRenameResponse> getRenames(Long instituteId) {
        validateInstitute(instituteId);
        return examRenameRepository.findAllByInstituteIdOrderByClassNameAscSubjectNameAscOldTitleAsc(instituteId)
                .stream()
                .map(this::toRenameResponse)
                .toList();
    }

    @Transactional
    public List<StudentMarkResponse> saveRegister(Long instituteId, StudentMarksRegisterPayload request) {
        return saveRegister(instituteId, null, request);
    }

    @Transactional
    public List<StudentMarkResponse> saveRegister(Long instituteId, AuthPrincipal principal, StudentMarksRegisterPayload request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession academicSession = resolveAcademicSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = resolveSchoolClass(instituteId, request.classId(), request.className());
        Subject subject = resolveSubject(instituteId, request.subjectId(), request.subjectName());
        String className = schoolClass.getName();
        String subjectName = subject.getName();

        if (request.exams().stream().noneMatch(exam -> StringUtils.hasText(exam.examTitle()) || exam.examId() != null)) {
            throw new IllegalArgumentException("At least one exam title is required.");
        }

        assertTeacherCanWriteMarks(principal, instituteId, academicSession.getId(), schoolClass.getId(), subject.getId());

        Set<Long> studentIds = request.exams().stream()
                .flatMap(exam -> exam.entries().stream())
                .map(StudentMarkEntryPayload::studentId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Student> studentsById = studentRepository.findAllByInstituteIdAndIdIn(instituteId, studentIds)
                .stream()
                .collect(Collectors.toMap(Student::getId, Function.identity()));
        if (studentsById.size() != studentIds.size()) {
            throw new ResourceNotFoundException("One or more students were not found in this institute.");
        }
        studentsById.values().forEach(student -> assertStudentBelongsToClass(student, className));

        List<StudentMark> records = request.exams().stream()
                .flatMap(exam -> upsertExamMarks(
                        institute,
                        academicSession,
                        schoolClass,
                        subject,
                        resolveExam(institute, academicSession, schoolClass, exam),
                        resolveUploadedBy(principal, request.uploadedBy()),
                        principal == null ? null : principal.accountId(),
                        exam,
                        studentsById
                ).stream())
                .toList();

        return studentMarkRepository.saveAll(records).stream()
                .map(this::toMarkResponse)
                .toList();
    }

    private List<StudentMark> upsertExamMarks(
            Institute institute,
            AcademicSession academicSession,
            SchoolClass schoolClass,
            Subject subject,
            ExamDefinition examDefinition,
            String uploadedBy,
            Long accountId,
            StudentMarksExamPayload exam,
            Map<Long, Student> studentsById
    ) {
        MarksRegister register = marksRegisterRepository
                .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectIdAndExamId(
                        institute.getId(),
                        academicSession.getId(),
                        schoolClass.getId(),
                        subject.getId(),
                        examDefinition.getId()
                )
                .orElseGet(() -> {
                    MarksRegister created = new MarksRegister();
                    created.setInstitute(institute);
                    created.setAcademicSession(academicSession);
                    created.setSchoolClass(schoolClass);
                    created.setSubject(subject);
                    created.setExam(examDefinition);
                    created.setCreatedByAccountId(accountId);
                    created.setUpdatedByAccountId(accountId);
                    return marksRegisterRepository.save(created);
                });
        if (resultPublicationRepository.existsByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamIdAndStatusIgnoreCase(
                institute.getId(),
                academicSession.getId(),
                schoolClass.getId(),
                examDefinition.getId(),
                "PUBLISHED"
        )) {
            throw new IllegalArgumentException("RESULT_PUBLISHED_MARKS_LOCKED");
        }
        if ("LOCKED".equalsIgnoreCase(register.getStatus())) {
            throw new IllegalArgumentException("MARKS_REGISTER_LOCKED");
        }
        register.setUpdatedByAccountId(accountId);

        Set<Long> studentIds = exam.entries().stream()
                .map(StudentMarkEntryPayload::studentId)
                .collect(Collectors.toSet());
        Map<Long, StudentMark> existingByStudentId = studentMarkRepository
                .findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectIdAndExamIdAndStudentIdIn(
                        institute.getId(),
                        academicSession.getId(),
                        schoolClass.getId(),
                        subject.getId(),
                        examDefinition.getId(),
                        studentIds
                )
                .stream()
                .collect(Collectors.toMap(mark -> mark.getStudent().getId(), Function.identity(), (left, right) -> left));

        return exam.entries().stream()
                .map(entry -> upsertMarkRecord(
                        existingByStudentId.get(entry.studentId()),
                        institute,
                        academicSession,
                        schoolClass,
                        subject,
                        examDefinition,
                        register,
                        uploadedBy,
                        accountId,
                        exam,
                        entry,
                        studentsById.get(entry.studentId())
                ))
                .toList();
    }

    @Transactional
    public List<StudentMarksExamRenameResponse> renameExam(Long instituteId, StudentMarksExamRenamePayload request) {
        Institute institute = validateInstitute(instituteId);
        String className = request.className().trim();
        String subjectName = request.subjectName().trim();
        String oldTitle = request.oldTitle().trim();
        String newTitle = request.newTitle().trim();

        List<StudentMark> matchingMarks = studentMarkRepository
                .findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndExamTitleIn(
                        instituteId,
                        className,
                        subjectName,
                        List.of(oldTitle)
                );
        if (matchingMarks.stream().map(StudentMark::getMarksRegister).filter(Objects::nonNull).anyMatch(register -> "LOCKED".equalsIgnoreCase(register.getStatus()))) {
            throw new IllegalArgumentException("MARKS_REGISTER_LOCKED");
        }
        matchingMarks.forEach(record -> record.setExamTitle(newTitle));
        studentMarkRepository.saveAll(matchingMarks);

        List<StudentMarksExamRename> matchingRenames = examRenameRepository
                .findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndOldTitleIgnoreCaseOrInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndNewTitleIgnoreCase(
                        instituteId,
                        className,
                        subjectName,
                        oldTitle,
                        instituteId,
                        className,
                        subjectName,
                        oldTitle
                );

        String sourceExamTitle = matchingRenames.stream()
                .map(StudentMarksExamRename::getOldTitle)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(oldTitle);
        examRenameRepository.deleteAll(matchingRenames);

        StudentMarksExamRename rename = new StudentMarksExamRename();
        rename.setInstitute(institute);
        rename.setClassName(className);
        rename.setSubjectName(subjectName);
        rename.setOldTitle(sourceExamTitle);
        rename.setNewTitle(newTitle);
        examRenameRepository.save(rename);

        return getRenames(instituteId);
    }

    private StudentMark createMarkRecord(
            Institute institute,
            String className,
            String subjectName,
            String uploadedBy,
            StudentMarksExamPayload exam,
            StudentMarkEntryPayload entry
    ) {
        Student student = studentRepository.findByInstituteIdAndId(institute.getId(), entry.studentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + entry.studentId()));

        BigDecimal marksObtained = entry.marksObtained();
        BigDecimal maxMarks = exam.maxMarks();
        if (marksObtained.compareTo(maxMarks) > 0) {
            throw new IllegalArgumentException("Marks cannot be greater than max marks for student " + entry.studentId() + ".");
        }

        StudentMark record = new StudentMark();
        record.setInstitute(institute);
        record.setStudent(student);
        record.setClassName(className);
        record.setSubjectName(subjectName);
        record.setExamTitle(exam.examTitle().trim());
        record.setExamDate(parseDate(exam.examDate()));
        record.setMaxMarks(maxMarks);
        record.setMarksObtained(marksObtained);
        record.setRollNo(defaultValue(entry.rollNo(), firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), String.valueOf(student.getId()))));
        record.setUploadedBy(defaultValue(uploadedBy, "Teacher"));
        return record;
    }

    private StudentMark upsertMarkRecord(
            StudentMark record,
            Institute institute,
            AcademicSession academicSession,
            SchoolClass schoolClass,
            Subject subject,
            ExamDefinition examDefinition,
            MarksRegister register,
            String uploadedBy,
            Long accountId,
            StudentMarksExamPayload exam,
            StudentMarkEntryPayload entry,
            Student student
    ) {
        if (student == null) {
            throw new ResourceNotFoundException("Student not found with id: " + entry.studentId());
        }
        BigDecimal marksObtained = entry.marksObtained();
        BigDecimal maxMarks = exam.maxMarks();
        if (marksObtained.compareTo(maxMarks) > 0) {
            throw new IllegalArgumentException("Marks cannot be greater than max marks for student " + entry.studentId() + ".");
        }

        StudentMark target = record == null ? new StudentMark() : record;
        target.setInstitute(institute);
        target.setAcademicSession(academicSession);
        target.setSchoolClass(schoolClass);
        target.setSubject(subject);
        target.setExam(examDefinition);
        target.setMarksRegister(register);
        target.setStudent(student);
        target.setClassName(schoolClass.getName());
        target.setSubjectName(subject.getName());
        target.setExamTitle(examDefinition.getTitle());
        target.setExamDate(parseDate(exam.examDate()));
        target.setMaxMarks(maxMarks);
        target.setMarksObtained(marksObtained);
        target.setStatus("PRESENT");
        target.setRollNo(defaultValue(entry.rollNo(), firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), String.valueOf(student.getId()))));
        target.setUploadedBy(uploadedBy);
        if (target.getId() == null) {
            target.setEnteredByAccountId(accountId);
        }
        target.setUpdatedByAccountId(accountId);
        return target;
    }

    private AcademicSession resolveAcademicSession(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            return academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Academic session not found with id: " + academicSessionId));
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElseThrow(() -> new IllegalArgumentException("CURRENT_ACADEMIC_SESSION_REQUIRED"));
    }

    private SchoolClass resolveSchoolClass(Long instituteId, Long classId, String className) {
        if (classId != null) {
            return schoolClassRepository.findByInstituteIdAndId(instituteId, classId)
                    .orElseThrow(() -> new ResourceNotFoundException("Class not found with id: " + classId));
        }
        String cleanClassName = cleanRequired(className, "Class name is required.");
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(cleanClassName))
                .or(() -> schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(cleanClassName.split("/")[0])))
                .orElseThrow(() -> new ResourceNotFoundException("Class master not found for marks register: " + cleanClassName));
    }

    private Subject resolveSubject(Long instituteId, Long subjectId, String subjectName) {
        if (subjectId != null) {
            return subjectRepository.findByInstituteIdAndId(instituteId, subjectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Subject not found with id: " + subjectId));
        }
        String cleanSubjectName = cleanRequired(subjectName, "Subject name is required.");
        return subjectRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(cleanSubjectName))
                .orElseThrow(() -> new ResourceNotFoundException("Subject master not found for marks register: " + cleanSubjectName));
    }

    private ExamDefinition resolveExam(Institute institute, AcademicSession academicSession, SchoolClass schoolClass, StudentMarksExamPayload exam) {
        if (exam.examId() != null) {
            return examDefinitionRepository.findByInstituteIdAndId(institute.getId(), exam.examId())
                    .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + exam.examId()));
        }
        String title = cleanRequired(exam.examTitle(), "Exam title is required.");
        LocalDate examDate = parseDate(exam.examDate());
        LocalDate identityDate = examDate == null ? LocalDate.of(1970, 1, 1) : examDate;
        return examDefinitionRepository
                .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndNormalizedTitleAndExamDate(
                        institute.getId(),
                        academicSession.getId(),
                        schoolClass.getId(),
                        normalizeName(title),
                        identityDate
                )
                .orElseGet(() -> {
                    ExamDefinition created = new ExamDefinition();
                    created.setInstitute(institute);
                    created.setAcademicSession(academicSession);
                    created.setSchoolClass(schoolClass);
                    created.setTitle(title);
                    created.setNormalizedTitle(normalizeName(title));
                    created.setExamDate(identityDate);
                    return examDefinitionRepository.save(created);
                });
    }

    private void assertTeacherCanWriteMarks(AuthPrincipal principal, Long instituteId, Long academicSessionId, Long classId, Long subjectId) {
        if (principal == null || !"TEACHER".equalsIgnoreCase(principal.role())) {
            return;
        }
        if (principal.teacherId() == null || !timetablePeriodRepository.existsPublishedTeacherSubjectAssignment(
                instituteId,
                academicSessionId,
                principal.teacherId(),
                classId,
                subjectId
        )) {
            throw new IllegalArgumentException("TEACHER_NOT_ASSIGNED_TO_MARKS_REGISTER");
        }
    }

    private void assertStudentBelongsToClass(Student student, String className) {
        String assignedClass = firstNonBlank(student.getAssignedClass(), student.getClassName());
        if (StringUtils.hasText(assignedClass)
                && !assignedClass.equalsIgnoreCase(className)
                && !assignedClass.toLowerCase().startsWith(className.toLowerCase() + " /")) {
            throw new IllegalArgumentException("Student " + student.getId() + " is not assigned to " + className + ".");
        }
    }

    private String resolveUploadedBy(AuthPrincipal principal, String fallback) {
        if (principal != null && StringUtils.hasText(principal.username())) {
            return principal.username();
        }
        return defaultValue(fallback, "Teacher");
    }

    private StudentMarkResponse toMarkResponse(StudentMark record) {
        Student student = record.getStudent();
        return new StudentMarkResponse(
                record.getId(),
                record.getClassName(),
                record.getSubjectName(),
                record.getExamTitle(),
                record.getExamDate() == null ? "" : record.getExamDate().toString(),
                record.getMaxMarks(),
                record.getMarksObtained(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(record.getRollNo(), student.getRollNo(), student.getEnrollmentNo()),
                record.getUploadedBy(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private StudentMarksExamRenameResponse toRenameResponse(StudentMarksExamRename record) {
        return new StudentMarksExamRenameResponse(
                record.getId(),
                record.getClassName(),
                record.getSubjectName(),
                record.getOldTitle(),
                record.getNewTitle(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) return null;
        return LocalDate.parse(value.trim());
    }

    private String cleanRequired(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String normalizeName(String value) {
        return cleanRequired(value, "Value is required.").toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private String buildStudentName(Student student) {
        return firstNonBlank(
                String.join(" ", defaultValue(student.getFirstName(), ""), defaultValue(student.getLastName(), "")).trim(),
                student.getName(),
                student.getEnrollmentNo(),
                "Unnamed student"
        );
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
