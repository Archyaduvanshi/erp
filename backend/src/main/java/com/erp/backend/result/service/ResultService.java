package com.erp.backend.result.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.curriculum.entity.ClassSubject;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.entity.Subject;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.curriculum.repository.ClassSubjectRepository;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.marks.entity.ExamDefinition;
import com.erp.backend.marks.entity.MarksRegister;
import com.erp.backend.marks.entity.ResultPublication;
import com.erp.backend.marks.entity.StudentMark;
import com.erp.backend.marks.repository.ExamDefinitionRepository;
import com.erp.backend.marks.repository.MarksRegisterRepository;
import com.erp.backend.marks.repository.ResultPublicationRepository;
import com.erp.backend.marks.repository.StudentMarkRepository;
import com.erp.backend.result.dto.ResultCellResponse;
import com.erp.backend.result.dto.ResultClassResponse;
import com.erp.backend.result.dto.ResultExamColumnResponse;
import com.erp.backend.result.dto.ResultPublicationResponse;
import com.erp.backend.result.dto.ResultStudentResponse;
import com.erp.backend.result.dto.ResultSubjectResponse;
import com.erp.backend.result.dto.ResultSummaryResponse;
import com.erp.backend.result.dto.StudentResultResponse;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;

@Service
public class ResultService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private final BigDecimal passPercentage;

    private final StudentRepository studentRepository;
    private final StudentMarkRepository studentMarkRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final ClassSubjectRepository classSubjectRepository;
    private final ExamDefinitionRepository examDefinitionRepository;
    private final ResultPublicationRepository resultPublicationRepository;
    private final MarksRegisterRepository marksRegisterRepository;

    public ResultService(
            StudentRepository studentRepository,
            StudentMarkRepository studentMarkRepository,
            AcademicSessionRepository academicSessionRepository,
            SchoolClassRepository schoolClassRepository,
            ClassSubjectRepository classSubjectRepository,
            ExamDefinitionRepository examDefinitionRepository,
            ResultPublicationRepository resultPublicationRepository,
            MarksRegisterRepository marksRegisterRepository,
            @Value("${erp.results.pass-percentage:33}") BigDecimal passPercentage
    ) {
        this.studentRepository = studentRepository;
        this.studentMarkRepository = studentMarkRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.classSubjectRepository = classSubjectRepository;
        this.examDefinitionRepository = examDefinitionRepository;
        this.resultPublicationRepository = resultPublicationRepository;
        this.marksRegisterRepository = marksRegisterRepository;
        this.passPercentage = passPercentage;
    }

    @Transactional(readOnly = true)
    public List<ResultClassResponse> getClasses(Long instituteId) {
        return getClasses(instituteId, null);
    }

    @Transactional(readOnly = true)
    public List<ResultClassResponse> getClasses(Long instituteId, Long academicSessionId) {
        AcademicSession academicSession = resolveAcademicSession(instituteId, academicSessionId);
        List<ResultClassResponse> summaries = studentMarkRepository.findResultClassSummaries(instituteId, academicSession.getId());
        if (!summaries.isEmpty()) {
            return summaries;
        }
        List<Student> students = studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId);
        List<StudentMark> marks = studentMarkRepository.findAllByInstituteIdOrderByClassNameAscSubjectNameAscExamTitleAscCreatedAtAsc(instituteId);
        Set<String> classNames = new LinkedHashSet<>();
        students.stream().map(this::studentClass).filter(StringUtils::hasText).forEach(classNames::add);
        marks.stream().map(StudentMark::getClassName).filter(StringUtils::hasText).forEach(classNames::add);

        return classNames.stream()
                .sorted(this::compareClassNames)
                .map(className -> {
                    List<Student> classStudents = students.stream()
                            .filter(student -> className.equalsIgnoreCase(studentClass(student)))
                            .toList();
                    List<StudentMark> classMarks = marks.stream()
                            .filter(mark -> className.equalsIgnoreCase(mark.getClassName()))
                            .toList();
                    int studentCount = classStudents.isEmpty()
                            ? (int) classMarks.stream().map(mark -> mark.getStudent().getId()).distinct().count()
                            : classStudents.size();
                    int resultCount = (int) classMarks.stream()
                            .map(mark -> mark.getStudent().getId() + "-" + defaultValue(mark.getExamTitle(), ""))
                            .distinct()
                            .count();
                    int subjectCount = (int) classMarks.stream()
                            .map(StudentMark::getSubjectName)
                            .filter(StringUtils::hasText)
                            .distinct()
                            .count();
                    return new ResultClassResponse(className, studentCount, resultCount, subjectCount);
                })
                .toList();
    }

    public List<ResultStudentResponse> getClassStudents(Long instituteId, String className) {
        return getClassStudents(instituteId, className, null, null);
    }

    @Transactional(readOnly = true)
    public List<ResultStudentResponse> getClassStudents(Long instituteId, String className, Long academicSessionId, Long examId) {
        String cleanClassName = cleanRequired(className, "Class name is required.");
        AcademicSession academicSession = resolveAcademicSession(instituteId, academicSessionId);
        List<ResultStudentResponse> normalizedStudents = studentMarkRepository.findResultStudents(
                instituteId,
                academicSession.getId(),
                cleanClassName,
                examId,
                passPercentage
        );
        if (!normalizedStudents.isEmpty()) {
            return normalizedStudents;
        }
        List<Student> students = studentRepository.findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByFirstNameAscLastNameAscCreatedAtAsc(instituteId, cleanClassName);
        List<StudentMark> marks = studentMarkRepository.findAllByInstituteIdAndClassNameIgnoreCaseOrderBySubjectNameAscExamTitleAscCreatedAtAsc(instituteId, cleanClassName);
        Map<Long, List<StudentMark>> marksByStudent = marks.stream()
                .filter(mark -> mark.getStudent() != null)
                .collect(Collectors.groupingBy(mark -> mark.getStudent().getId(), LinkedHashMap::new, Collectors.toList()));
        Map<Long, ResultStudentResponse> studentMap = new LinkedHashMap<>();

        students.forEach(student -> studentMap.put(student.getId(), toStudentResponse(student, cleanClassName, marksByStudent.getOrDefault(student.getId(), List.of()))));
        marks.forEach(mark -> {
            Long studentId = mark.getStudent().getId();
            studentMap.putIfAbsent(studentId, toStudentResponse(mark.getStudent(), cleanClassName, marksByStudent.getOrDefault(studentId, List.of())));
        });

        return studentMap.values().stream()
                .sorted(Comparator.comparing(ResultStudentResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public StudentResultResponse getStudentResult(Long instituteId, String className, Long studentId) {
        return getStudentResult(instituteId, className, studentId, null, null);
    }

    @Transactional(readOnly = true)
    public StudentResultResponse getMyStudentResult(Long instituteId, Long studentId, Long academicSessionId, Long examId) {
        Student student = studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
        return getStudentResult(instituteId, studentClass(student), studentId, academicSessionId, examId, true);
    }

    @Transactional(readOnly = true)
    public StudentResultResponse getStudentResult(Long instituteId, String className, Long studentId, Long academicSessionId, Long examId) {
        return getStudentResult(instituteId, className, studentId, academicSessionId, examId, false);
    }

    private StudentResultResponse getStudentResult(Long instituteId, String className, Long studentId, Long academicSessionId, Long examId, boolean publishedOnly) {
        String cleanClassName = cleanRequired(className, "Class name is required.");
        AcademicSession academicSession = resolveAcademicSession(instituteId, academicSessionId);
        Student student = studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
        SchoolClass schoolClass = resolveSchoolClass(instituteId, cleanClassName);
        if (publishedOnly) {
            List<Long> publishedExamIds = resultPublicationRepository.findPublishedExamIds(instituteId, academicSession.getId(), schoolClass.getId());
            if (examId != null && !publishedExamIds.contains(examId)) {
                return emptyStudentResult(student, cleanClassName, academicSession, schoolClass, null);
            }
            if (examId == null && publishedExamIds.isEmpty()) {
                return emptyStudentResult(student, cleanClassName, academicSession, schoolClass, null);
            }
        }
        List<StudentMark> studentMarks = publishedOnly
                ? studentMarkRepository.findPublishedStudentResults(instituteId, studentId, academicSession.getId(), examId)
                : examId == null
                ? studentMarkRepository.findAllByInstituteIdAndStudentIdAndAcademicSessionIdOrderByExamDateAscSubjectNameAscCreatedAtAsc(
                        instituteId,
                        studentId,
                        academicSession.getId()
                )
                : studentMarkRepository.findAllByInstituteIdAndStudentIdAndAcademicSessionIdAndExamIdOrderBySubjectNameAscCreatedAtAsc(
                        instituteId,
                        studentId,
                        academicSession.getId(),
                        examId
                );
        List<ResultSubjectResponse> subjects = buildSubjects(instituteId, academicSession.getId(), schoolClass, studentMarks);
        List<ResultExamColumnResponse> exams = buildExamColumns(instituteId, academicSession.getId(), schoolClass, studentMarks, examId, publishedOnly);
        Map<String, StudentMark> markMap = studentMarks.stream()
                .filter(mark -> mark.getSubject() != null && mark.getExam() != null)
                .collect(Collectors.toMap(
                        mark -> resultCellKey(mark.getSubject().getId(), mark.getExam().getId()),
                        mark -> mark,
                        (existing, replacement) -> replacement
                ));
        List<ResultCellResponse> cells = new ArrayList<>();
        List<ResultSummaryResponse> summaries = new ArrayList<>();

        exams.forEach(exam -> {
            BigDecimal obtainedTotal = BigDecimal.ZERO;
            BigDecimal maxTotal = BigDecimal.ZERO;

            for (ResultSubjectResponse subject : subjects) {
                StudentMark mark = markMap.get(resultCellKey(subject.subjectId(), exam.examId()));
                if (mark == null) {
                    cells.add(pendingCell(subject, exam));
                    continue;
                }
                if (!isExcludedFromTotals(mark)) {
                    obtainedTotal = obtainedTotal.add(nullSafe(mark.getMarksObtained()));
                    maxTotal = maxTotal.add(nullSafe(mark.getMaxMarks()));
                }
                cells.add(toCellResponse(mark, exam.key()));
            }

            summaries.add(new ResultSummaryResponse(
                    exam.examId(),
                    exam.key(),
                    obtainedTotal,
                    maxTotal,
                    calculatePercentage(obtainedTotal, maxTotal)
            ));
        });

        return new StudentResultResponse(
                toStudentResponse(student, cleanClassName, studentMarks),
                subjects,
                exams,
                cells,
                summaries
        );
    }

    @Transactional(readOnly = true)
    public List<ResultExamColumnResponse> getClassExams(Long instituteId, String className, Long academicSessionId, boolean publishedOnly) {
        AcademicSession academicSession = resolveAcademicSession(instituteId, academicSessionId);
        SchoolClass schoolClass = resolveSchoolClass(instituteId, cleanRequired(className, "Class name is required."));
        return buildExamColumns(instituteId, academicSession.getId(), schoolClass, List.of(), null, publishedOnly);
    }

    @Transactional
    public ResultPublicationResponse publishResult(AuthPrincipal principal, String className, Long academicSessionId, Long examId) {
        AcademicSession academicSession = resolveAcademicSession(principal.instituteId(), academicSessionId);
        SchoolClass schoolClass = resolveSchoolClass(principal.instituteId(), cleanRequired(className, "Class name is required."));
        ExamDefinition exam = examDefinitionRepository.findByInstituteIdAndId(principal.instituteId(), examId)
                .filter(candidate -> Objects.equals(candidate.getAcademicSession().getId(), academicSession.getId()))
                .filter(candidate -> Objects.equals(candidate.getSchoolClass().getId(), schoolClass.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));
        List<MarksRegister> registers = marksRegisterRepository.findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamId(
                principal.instituteId(),
                academicSession.getId(),
                schoolClass.getId(),
                exam.getId()
        );
        if (registers.isEmpty()) {
            throw new IllegalArgumentException("MARKS_REGISTER_REQUIRED_BEFORE_PUBLISH");
        }
        validatePublicationCompleteness(principal.instituteId(), academicSession, schoolClass, exam, registers);
        ResultPublication publication = resultPublicationRepository
                .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamId(principal.instituteId(), academicSession.getId(), schoolClass.getId(), exam.getId())
                .orElseGet(ResultPublication::new);
        if (publication.getId() == null) {
            publication.setInstitute(exam.getInstitute());
            publication.setAcademicSession(academicSession);
            publication.setSchoolClass(schoolClass);
            publication.setExam(exam);
        }
        publication.setStatus("PUBLISHED");
        publication.setPublishedByAccountId(principal.accountId());
        publication.setPublishedAt(java.time.LocalDateTime.now());
        publication.setLockedAt(java.time.LocalDateTime.now());
        marksRegisterRepository.updateStatusForExam(principal.instituteId(), academicSession.getId(), schoolClass.getId(), exam.getId(), "LOCKED", principal.accountId());
        return toPublicationResponse(resultPublicationRepository.save(publication));
    }

    @Transactional
    public ResultPublicationResponse reopenResult(AuthPrincipal principal, String className, Long academicSessionId, Long examId, String reason) {
        AcademicSession academicSession = resolveAcademicSession(principal.instituteId(), academicSessionId);
        SchoolClass schoolClass = resolveSchoolClass(principal.instituteId(), cleanRequired(className, "Class name is required."));
        ResultPublication publication = resultPublicationRepository
                .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndExamId(principal.instituteId(), academicSession.getId(), schoolClass.getId(), examId)
                .orElseThrow(() -> new ResourceNotFoundException("Result publication not found for selected exam."));
        publication.setStatus("REOPENED");
        publication.setReopenedByAccountId(principal.accountId());
        publication.setReopenedAt(java.time.LocalDateTime.now());
        publication.setReopenReason(cleanRequired(reason, "REOPEN_REASON_REQUIRED"));
        publication.setLockedAt(null);
        marksRegisterRepository.updateStatusForExam(principal.instituteId(), academicSession.getId(), schoolClass.getId(), examId, "DRAFT", principal.accountId());
        return toPublicationResponse(resultPublicationRepository.save(publication));
    }

    private void validatePublicationCompleteness(Long instituteId, AcademicSession academicSession, SchoolClass schoolClass, ExamDefinition exam, List<MarksRegister> registers) {
        List<ClassSubject> expectedSubjects = classSubjectRepository
                .findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdOrderByDisplayOrderAscSubject_NameAsc(instituteId, academicSession.getId(), schoolClass.getId())
                .stream()
                .filter(classSubject -> !"ARCHIVED".equalsIgnoreCase(defaultValue(classSubject.getStatus(), "ACTIVE")))
                .toList();
        if (expectedSubjects.isEmpty()) {
            throw new IllegalArgumentException("CURRICULUM_SUBJECTS_REQUIRED_BEFORE_PUBLISH");
        }

        Set<Long> registeredSubjectIds = registers.stream()
                .filter(register -> register.getSubject() != null)
                .map(register -> register.getSubject().getId())
                .collect(Collectors.toSet());
        List<String> missingRegisters = expectedSubjects.stream()
                .filter(classSubject -> classSubject.getSubject() != null)
                .filter(classSubject -> !registeredSubjectIds.contains(classSubject.getSubject().getId()))
                .map(classSubject -> classSubject.getSubject().getName())
                .toList();
        if (!missingRegisters.isEmpty()) {
            throw new IllegalArgumentException("MISSING_MARKS_REGISTER_FOR_SUBJECTS: " + String.join(", ", missingRegisters));
        }

        List<ResultStudentResponse> students = studentMarkRepository.findResultStudents(
                instituteId,
                academicSession.getId(),
                schoolClass.getName(),
                exam.getId(),
                passPercentage
        );
        if (students.isEmpty()) {
            throw new IllegalArgumentException("RESULT_STUDENTS_REQUIRED_BEFORE_PUBLISH");
        }
        long incomplete = students.stream()
                .filter(student -> "Pending".equalsIgnoreCase(student.status()))
                .count();
        if (incomplete > 0) {
            throw new IllegalArgumentException("RESULT_INCOMPLETE_FOR_STUDENTS: " + incomplete + " student(s) have missing or NOT_ENTERED marks.");
        }
    }

    private StudentResultResponse emptyStudentResult(Student student, String className, AcademicSession academicSession, SchoolClass schoolClass, Long examId) {
        List<ResultSubjectResponse> subjects = buildSubjects(student.getInstitute().getId(), academicSession.getId(), schoolClass, List.of());
        List<ResultExamColumnResponse> exams = buildExamColumns(student.getInstitute().getId(), academicSession.getId(), schoolClass, List.of(), examId, true);
        return new StudentResultResponse(toStudentResponse(student, className, List.of()), subjects, exams, List.of(), List.of());
    }

    private List<ResultSubjectResponse> buildSubjects(Long instituteId, Long academicSessionId, SchoolClass schoolClass, List<StudentMark> marks) {
        Map<Long, ResultSubjectResponse> subjects = new LinkedHashMap<>();
        classSubjectRepository.findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdOrderByDisplayOrderAscSubject_NameAsc(instituteId, academicSessionId, schoolClass.getId()).stream()
                .filter(classSubject -> !"ARCHIVED".equalsIgnoreCase(defaultValue(classSubject.getStatus(), "ACTIVE")))
                .map(ClassSubject::getSubject)
                .forEach(subject -> subjects.put(subject.getId(), new ResultSubjectResponse(subject.getId(), subject.getName())));
        marks.stream()
                .map(StudentMark::getSubject)
                .filter(Objects::nonNull)
                .forEach(subject -> subjects.putIfAbsent(subject.getId(), new ResultSubjectResponse(subject.getId(), subject.getName())));
        return subjects.values().stream()
                .sorted(Comparator.comparing(ResultSubjectResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<ResultExamColumnResponse> buildExamColumns(Long instituteId, Long academicSessionId, SchoolClass schoolClass, List<StudentMark> marks, Long examId, boolean publishedOnly) {
        List<ExamDefinition> definitions;
        if (examId != null) {
            definitions = examDefinitionRepository.findByInstituteIdAndId(instituteId, examId)
                    .filter(exam -> Objects.equals(exam.getAcademicSession().getId(), academicSessionId))
                    .filter(exam -> Objects.equals(exam.getSchoolClass().getId(), schoolClass.getId()))
                    .map(List::of)
                    .orElse(List.of());
        } else if (publishedOnly) {
            List<Long> publishedExamIds = resultPublicationRepository.findPublishedExamIds(instituteId, academicSessionId, schoolClass.getId());
            definitions = publishedExamIds.isEmpty()
                    ? List.of()
                    : examDefinitionRepository.findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndIdInOrderByExamDateAscTitleAsc(instituteId, academicSessionId, schoolClass.getId(), publishedExamIds);
        } else {
            definitions = examDefinitionRepository.findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdOrderByExamDateAscTitleAsc(instituteId, academicSessionId, schoolClass.getId());
        }
        Map<Long, ExamMeta> examMap = new LinkedHashMap<>();
        definitions.forEach(exam -> examMap.put(exam.getId(), new ExamMeta(
                exam.getId(),
                "exam:" + exam.getId(),
                exam.getTitle(),
                exam.getExamDate() == null || exam.getExamDate().getYear() == 1970 ? "" : exam.getExamDate().format(DATE_FORMATTER),
                new LinkedHashSet<>()
        )));
        marks.stream().filter(mark -> mark.getExam() != null).forEach(mark -> {
            ExamDefinition exam = mark.getExam();
            ExamMeta meta = examMap.computeIfAbsent(exam.getId(), ignored -> new ExamMeta(
                    exam.getId(),
                    "exam:" + exam.getId(),
                    exam.getTitle(),
                    exam.getExamDate() == null || exam.getExamDate().getYear() == 1970 ? "" : exam.getExamDate().format(DATE_FORMATTER),
                    new LinkedHashSet<>()
            ));
            if (mark.getMaxMarks() != null && mark.getMaxMarks().compareTo(BigDecimal.ZERO) > 0) {
                meta.maxMarksValues().add(mark.getMaxMarks().stripTrailingZeros().toPlainString());
            }
        });

        return examMap.values().stream()
                .sorted(this::compareExamMeta)
                .map(meta -> new ResultExamColumnResponse(
                        meta.examId(),
                        meta.key(),
                        meta.title(),
                        meta.examDate(),
                        meta.maxMarksValues().size() == 1 ? meta.maxMarksValues().iterator().next() + " marks" : "Marks vary"
                ))
                .toList();
    }

    private ResultStudentResponse toStudentResponse(Student student, String className, List<StudentMark> marks) {
        int subjectCount = (int) marks.stream()
                .map(StudentMark::getSubjectName)
                .filter(StringUtils::hasText)
                .distinct()
                .count();
        boolean hasPending = marks.stream().anyMatch(mark -> "NOT_ENTERED".equals(normalizeMarkStatus(mark.getStatus())));
        boolean hasAbsent = marks.stream().anyMatch(mark -> "ABSENT".equals(normalizeMarkStatus(mark.getStatus())));
        boolean allExempt = !marks.isEmpty() && marks.stream().allMatch(mark -> "EXEMPT".equals(normalizeMarkStatus(mark.getStatus())));
        BigDecimal obtained = marks.stream()
                .filter(mark -> !isExcludedFromTotals(mark))
                .map(StudentMark::getMarksObtained)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = marks.stream()
                .filter(mark -> !isExcludedFromTotals(mark))
                .map(StudentMark::getMaxMarks)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int percentage = calculatePercentage(obtained, total);
        String status = marks.isEmpty() || hasPending
                ? "Pending"
                : allExempt
                ? "Exempt"
                : hasAbsent || total.compareTo(BigDecimal.ZERO) <= 0
                ? "Fail"
                : percentage >= passPercentage.intValue() ? "Pass" : "Fail";
        return new ResultStudentResponse(student.getId(), studentName(student), rollNo(student), className, subjectCount, status);
    }

    private ResultCellResponse toCellResponse(StudentMark mark, String examKey) {
        int percentage = calculatePercentage(nullSafe(mark.getMarksObtained()), nullSafe(mark.getMaxMarks()));
        String markStatus = normalizeMarkStatus(mark.getStatus());
        return new ResultCellResponse(
                mark.getSubject() == null ? null : mark.getSubject().getId(),
                mark.getSubjectName(),
                mark.getExam() == null ? null : mark.getExam().getId(),
                examKey,
                mark.getMaxMarks(),
                mark.getMarksObtained(),
                percentage,
                resultStatus(markStatus, percentage, mark.getMaxMarks()),
                mark.getUploadedBy()
        );
    }

    private ResultCellResponse pendingCell(ResultSubjectResponse subject, ResultExamColumnResponse exam) {
        return new ResultCellResponse(subject.subjectId(), subject.name(), exam.examId(), exam.key(), BigDecimal.ZERO, BigDecimal.ZERO, 0, "Pending", "");
    }

    private List<StudentMark> studentMarks(List<StudentMark> marks, Long studentId) {
        return marks.stream()
                .filter(mark -> mark.getStudent() != null && Objects.equals(mark.getStudent().getId(), studentId))
                .toList();
    }

    private int calculatePercentage(BigDecimal obtained, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) <= 0) return 0;
        return obtained.multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP).intValue();
    }

    private BigDecimal nullSafe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String resultCellKey(Long subjectId, Long examId) {
        return subjectId + "__" + examId;
    }

    private String cleanRequired(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private AcademicSession resolveAcademicSession(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            return academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Academic session not found with id: " + academicSessionId));
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElseThrow(() -> new IllegalArgumentException("CURRENT_ACADEMIC_SESSION_REQUIRED"));
    }

    private SchoolClass resolveSchoolClass(Long instituteId, String className) {
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(className))
                .or(() -> schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(className.split("/")[0])))
                .orElseThrow(() -> new ResourceNotFoundException("Class master not found: " + className));
    }

    private String studentClass(Student student) {
        return firstNonBlank(student.getAssignedClass(), student.getClassName());
    }

    private String studentName(Student student) {
        return firstNonBlank(
                String.join(" ", defaultValue(student.getFirstName(), ""), defaultValue(student.getLastName(), "")).trim(),
                student.getName(),
                student.getEnrollmentNo(),
                "Unnamed student"
        );
    }

    private String rollNo(Student student) {
        return firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), String.valueOf(student.getId()));
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

    private boolean isExcludedFromTotals(StudentMark mark) {
        String status = normalizeMarkStatus(mark.getStatus());
        return "EXEMPT".equals(status) || "NOT_ENTERED".equals(status);
    }

    private String normalizeMarkStatus(String status) {
        String token = defaultValue(status, "PRESENT").trim().replace('-', '_').replace(' ', '_').toUpperCase();
        if ("ABSENT".equals(token) || "EXEMPT".equals(token) || "NOT_ENTERED".equals(token)) return token;
        return "PRESENT";
    }

    private String resultStatus(String markStatus, int percentage, BigDecimal maxMarks) {
        if ("EXEMPT".equals(markStatus)) return "Exempt";
        if ("NOT_ENTERED".equals(markStatus)) return "Pending";
        if (maxMarks == null || maxMarks.compareTo(BigDecimal.ZERO) <= 0) return "Pending";
        if ("ABSENT".equals(markStatus)) return "Fail";
        return percentage >= passPercentage.intValue() ? "Pass" : "Fail";
    }

    private ResultPublicationResponse toPublicationResponse(ResultPublication publication) {
        return new ResultPublicationResponse(
                publication.getId(),
                publication.getAcademicSession().getId(),
                publication.getSchoolClass().getId(),
                publication.getSchoolClass().getName(),
                publication.getExam().getId(),
                publication.getExam().getTitle(),
                publication.getStatus(),
                publication.getPublishedByAccountId(),
                publication.getPublishedAt(),
                publication.getReopenedByAccountId(),
                publication.getReopenedAt(),
                publication.getReopenReason(),
                publication.getLockedAt()
        );
    }

    private String normalizeName(String value) {
        return cleanRequired(value, "Value is required.").toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private int compareClassNames(String left, String right) {
        int leftRank = classRank(left);
        int rightRank = classRank(right);
        if (leftRank != rightRank) return leftRank - rightRank;
        return left.compareToIgnoreCase(right);
    }

    private int classRank(String value) {
        String normalized = defaultValue(value, "").toLowerCase();
        if (normalized.contains("nursery")) return 0;
        if (normalized.contains("lkg")) return 1;
        if (normalized.contains("ukg")) return 2;
        String digits = normalized.replaceAll("\\D+", "");
        return digits.isBlank() ? 1000 : 2 + Integer.parseInt(digits);
    }

    private int compareExamMeta(ExamMeta left, ExamMeta right) {
        if (StringUtils.hasText(left.examDate()) && StringUtils.hasText(right.examDate()) && !left.examDate().equals(right.examDate())) {
            return left.examDate().compareTo(right.examDate());
        }
        if (StringUtils.hasText(left.examDate())) return -1;
        if (StringUtils.hasText(right.examDate())) return 1;
        return left.title().compareToIgnoreCase(right.title());
    }

    private record ExamMeta(Long examId, String key, String title, String examDate, Set<String> maxMarksValues) {
    }
}
