package com.erp.backend.examination.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.ClassSubject;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.entity.Subject;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.curriculum.repository.ClassSectionRepository;
import com.erp.backend.curriculum.repository.ClassSubjectRepository;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.curriculum.repository.SubjectRepository;
import com.erp.backend.examination.dto.ExamAdmitCardPayload;
import com.erp.backend.examination.dto.ExamAdmitCardBulkPayload;
import com.erp.backend.examination.dto.ExamAdmitCardResponse;
import com.erp.backend.examination.dto.ExamDateSheetPayload;
import com.erp.backend.examination.dto.ExamDateSheetResponse;
import com.erp.backend.examination.dto.ExamOptionClassResponse;
import com.erp.backend.examination.dto.ExamOptionExamResponse;
import com.erp.backend.examination.dto.ExamOptionResponse;
import com.erp.backend.examination.dto.ExamOptionSectionResponse;
import com.erp.backend.examination.dto.ExamOptionSubjectResponse;
import com.erp.backend.examination.dto.ExamOverviewResponse;
import com.erp.backend.examination.dto.ExamQuestionPaperPayload;
import com.erp.backend.examination.dto.ExamQuestionPaperResponse;
import com.erp.backend.examination.dto.StudentExamPortalResponse;
import com.erp.backend.examination.dto.TeacherExamPortalResponse;
import com.erp.backend.examination.entity.Exam;
import com.erp.backend.examination.entity.ExamAdmitCard;
import com.erp.backend.examination.entity.ExamDateSheet;
import com.erp.backend.examination.entity.ExamQuestionPaper;
import com.erp.backend.examination.entity.ExamSchedule;
import com.erp.backend.examination.repository.ExamAdmitCardRepository;
import com.erp.backend.examination.repository.ExamDateSheetRepository;
import com.erp.backend.examination.repository.ExamRepository;
import com.erp.backend.examination.repository.ExamQuestionPaperRepository;
import com.erp.backend.examination.repository.ExamScheduleRepository;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.timetable.dto.TimetablePeriodProjection;
import com.erp.backend.timetable.repository.TimetablePeriodRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ExaminationService {
    private final InstituteRepository instituteRepository;
    private final ExamDateSheetRepository examDateSheetRepository;
    private final ExamQuestionPaperRepository examQuestionPaperRepository;
    private final ExamAdmitCardRepository examAdmitCardRepository;
    private final ExamScheduleRepository examScheduleRepository;
    private final ExamRepository examRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final ClassSectionRepository classSectionRepository;
    private final SubjectRepository subjectRepository;
    private final ClassSubjectRepository classSubjectRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final TimetablePeriodRepository timetablePeriodRepository;
    private final ObjectMapper objectMapper;

    public ExaminationService(
            InstituteRepository instituteRepository,
            ExamDateSheetRepository examDateSheetRepository,
            ExamQuestionPaperRepository examQuestionPaperRepository,
            ExamAdmitCardRepository examAdmitCardRepository,
            ExamScheduleRepository examScheduleRepository,
            ExamRepository examRepository,
            AcademicSessionRepository academicSessionRepository,
            SchoolClassRepository schoolClassRepository,
            ClassSectionRepository classSectionRepository,
            SubjectRepository subjectRepository,
            ClassSubjectRepository classSubjectRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            TimetablePeriodRepository timetablePeriodRepository,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.examDateSheetRepository = examDateSheetRepository;
        this.examQuestionPaperRepository = examQuestionPaperRepository;
        this.examAdmitCardRepository = examAdmitCardRepository;
        this.examScheduleRepository = examScheduleRepository;
        this.examRepository = examRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.classSectionRepository = classSectionRepository;
        this.subjectRepository = subjectRepository;
        this.classSubjectRepository = classSubjectRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.timetablePeriodRepository = timetablePeriodRepository;
        this.objectMapper = objectMapper;
    }

    public ExamOverviewResponse getOverview(Long instituteId, Long academicSessionId) {
        AcademicSession session = resolveAcademicSession(instituteId, academicSessionId);
        return new ExamOverviewResponse(
                examRepository.countActiveBySession(instituteId, session.getId()),
                examRepository.countUpcoming(instituteId, session.getId()),
                examDateSheetRepository.countByInstituteIdAndAcademicSessionIdAndStatusIgnoreCase(instituteId, session.getId(), "PUBLISHED"),
                examQuestionPaperRepository.countActiveBySession(instituteId, session.getId()),
                examAdmitCardRepository.countActiveBySession(instituteId, session.getId()),
                examRepository.findNextExamDate(instituteId, session.getId())
        );
    }

    public ExamOptionResponse getOptions(Long instituteId, Long academicSessionId) {
        AcademicSession session = resolveAcademicSession(instituteId, academicSessionId);
        List<Exam> exams = examRepository.findAllByInstituteIdAndAcademicSessionIdOrderByStartDateAscNameAsc(instituteId, session.getId());
        Map<Long, List<ClassSection>> sectionsByClass = classSectionRepository.findAllByInstituteIdOrderBySchoolClassIdAscNameAsc(instituteId)
                .stream()
                .collect(Collectors.groupingBy(section -> section.getSchoolClass().getId(), LinkedHashMap::new, Collectors.toList()));
        Map<Long, List<ClassSubject>> subjectsByClass = classSubjectRepository.findAllByInstituteIdAndAcademicSessionId(instituteId, session.getId())
                .stream()
                .filter(classSubject -> !"ARCHIVED".equalsIgnoreCase(classSubject.getStatus()))
                .collect(Collectors.groupingBy(classSubject -> classSubject.getSchoolClass().getId(), LinkedHashMap::new, Collectors.toList()));

        List<ExamOptionClassResponse> classes = schoolClassRepository.findAllByInstituteIdOrderByNameAsc(instituteId)
                .stream()
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(schoolClass.getStatus()))
                .map(schoolClass -> new ExamOptionClassResponse(
                        schoolClass.getId(),
                        schoolClass.getName(),
                        sectionsByClass.getOrDefault(schoolClass.getId(), List.of()).stream()
                                .map(section -> new ExamOptionSectionResponse(section.getId(), section.getName()))
                                .toList(),
                        subjectsByClass.getOrDefault(schoolClass.getId(), List.of()).stream()
                                .map(classSubject -> new ExamOptionSubjectResponse(classSubject.getSubject().getId(), classSubject.getSubject().getName()))
                                .toList()
                ))
                .toList();

        return new ExamOptionResponse(
                session.getId(),
                exams.stream()
                        .map(exam -> new ExamOptionExamResponse(
                                exam.getId(),
                                exam.getName(),
                                exam.getExamType(),
                                exam.getStartDate() == null ? "" : exam.getStartDate().toString(),
                                exam.getEndDate() == null ? "" : exam.getEndDate().toString(),
                                exam.getStatus()
                        ))
                        .toList(),
                classes
        );
    }

    public Page<ExamDateSheetResponse> getDateSheets(Long instituteId, Long academicSessionId, Long examId, Long classId, String status, String search, Pageable pageable) {
        return examDateSheetRepository.findDateSheets(instituteId, academicSessionId, examId, classId, blankToEmpty(status), blankToEmpty(search), pageable)
                .map(this::toDateSheetResponse);
    }

    public Page<ExamQuestionPaperResponse> getQuestionPapers(Long instituteId, Long academicSessionId, Long examId, Long classId, Long subjectId, String status, String search, Pageable pageable) {
        return examQuestionPaperRepository.findQuestionPapers(instituteId, academicSessionId, examId, classId, subjectId, blankToEmpty(status), blankToEmpty(search), pageable)
                .map(this::toQuestionPaperResponse);
    }

    public Page<ExamAdmitCardResponse> getAdmitCards(Long instituteId, Long academicSessionId, Long examId, Long classId, String status, String search, Pageable pageable) {
        return examAdmitCardRepository.findAdmitCards(instituteId, academicSessionId, examId, classId, blankToEmpty(status), blankToEmpty(search), pageable)
                .map(this::toAdmitCardResponse);
    }

    public StudentExamPortalResponse getStudentPortal(AuthPrincipal principal, Long academicSessionId) {
        if (principal == null || principal.studentId() == null) {
            throw new ResourceNotFoundException("Student principal not found.");
        }
        Student student = studentRepository.findByInstituteIdAndId(principal.instituteId(), principal.studentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + principal.studentId()));
        AcademicSession session = resolveAcademicSession(principal.instituteId(), academicSessionId);
        String className = firstNonBlank(student.getAssignedClass(), student.getClassName());
        Long classId = resolveStudentClass(student, principal.instituteId(), className);
        Long sectionId = resolveStudentSection(principal.instituteId(), classId, student.getSection(), className);
        String baseClassName = parseBaseClass(className);

        List<ExamDateSheet> scheduleDateSheets = classId == null
                ? List.of()
                : examDateSheetRepository.findPublishedForStudentSchedule(principal.instituteId(), session.getId(), classId, sectionId);
        List<ExamDateSheetResponse> dateSheets = (scheduleDateSheets.isEmpty()
                ? examDateSheetRepository
                        .findStudentVisibleCandidates(principal.instituteId(), session.getId(), classId, className, baseClassName)
                        .stream()
                        .filter(dateSheet -> doesDateSheetMatchClass(dateSheet, className, baseClassName))
                        .toList()
                : scheduleDateSheets)
                .stream()
                .map(this::toDateSheetResponse)
                .toList();
        List<ExamQuestionPaperResponse> papers = examQuestionPaperRepository
                .findReleasedForStudentClass(principal.instituteId(), session.getId(), classId, className)
                .stream()
                .map(this::toQuestionPaperResponse)
                .toList();
        List<ExamAdmitCardResponse> cards = examAdmitCardRepository
                .findPublishedForStudent(principal.instituteId(), session.getId(), student.getId(), firstNonBlank(student.getEnrollmentNo(), String.valueOf(student.getId())))
                .stream()
                .map(this::toAdmitCardResponse)
                .toList();

        return new StudentExamPortalResponse(student.getId(), buildStudentName(student), className, dateSheets, papers, cards);
    }

    public TeacherExamPortalResponse getTeacherPortal(AuthPrincipal principal, Long academicSessionId) {
        if (principal == null || principal.teacherId() == null) {
            throw new ResourceNotFoundException("Teacher principal not found.");
        }
        AcademicSession session = resolveAcademicSession(principal.instituteId(), academicSessionId);
        List<TimetablePeriodProjection> periods = timetablePeriodRepository.findTeacherPeriodProjections(
                principal.instituteId(),
                session.getId(),
                principal.teacherId()
        );
        Map<Long, ExamOptionClassResponse> assignedClasses = new LinkedHashMap<>();
        periods.forEach(period -> assignedClasses.compute(period.classId(), (ignored, existing) -> {
            List<ExamOptionSubjectResponse> subjects = existing == null ? new ArrayList<>() : new ArrayList<>(existing.subjects());
            if (subjects.stream().noneMatch(subject -> subject.subjectName().equalsIgnoreCase(period.subjectName()))) {
                subjects.add(new ExamOptionSubjectResponse(null, period.subjectName()));
            }
            return new ExamOptionClassResponse(period.classId(), period.className(), List.of(), subjects);
        }));

        List<ExamDateSheetResponse> dateSheets = examDateSheetRepository
                .findPublishedForTeacherAssignments(principal.instituteId(), session.getId(), principal.teacherId())
                .stream()
                .map(this::toDateSheetResponse)
                .toList();
        List<ExamQuestionPaperResponse> papers = examQuestionPaperRepository
                .findVisibleForTeacher(principal.instituteId(), session.getId(), principal.teacherId())
                .stream()
                .map(this::toQuestionPaperResponse)
                .toList();

        return new TeacherExamPortalResponse(principal.teacherId(), List.copyOf(assignedClasses.values()), dateSheets, papers);
    }

    public List<ExamDateSheetResponse> getDateSheets(Long instituteId) {
        return examDateSheetRepository.findAllByInstituteIdOrderByClassNameAsc(instituteId)
                .stream()
                .sorted(Comparator.comparing(ExamDateSheet::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ExamDateSheet::getExamType, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toDateSheetResponse)
                .toList();
    }

    @Transactional
    public ExamDateSheetResponse saveDateSheet(Long instituteId, ExamDateSheetPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateDateSheetPayload(request);
        AcademicSession session = resolveAcademicSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = request.classId() == null ? null : resolveSchoolClass(instituteId, request.classId(), request.className());
        Exam exam = resolveOrCreateExam(institute, session, request.examId(), request.examType(), parseDate(request.examStartDate(), "examStartDate", "Exam start date must be valid.", new LinkedHashMap<>()), parseDate(request.examEndDate(), "examEndDate", "Exam end date must be valid.", new LinkedHashMap<>()), null);
        ExamDateSheet dateSheet = request.classId() == null
                ? examDateSheetRepository.findByInstituteIdAndClassNameIgnoreCase(instituteId, request.className().trim()).orElseGet(ExamDateSheet::new)
                : examDateSheetRepository.findDateSheets(instituteId, session.getId(), exam.getId(), schoolClass.getId(), "", "", Pageable.ofSize(1))
                        .stream()
                        .findFirst()
                        .orElseGet(ExamDateSheet::new);

        if (dateSheet.getId() == null) {
            dateSheet.setInstitute(institute);
        }
        dateSheet.setAcademicSession(session);
        dateSheet.setExam(exam);
        dateSheet.setSchoolClass(schoolClass);
        dateSheet.setSection(schoolClass == null ? null : resolveSection(instituteId, request.sectionId(), schoolClass.getId()));

        applyDateSheetPayload(dateSheet, request);
        ExamDateSheet savedDateSheet = examDateSheetRepository.save(dateSheet);
        replaceExamSchedulesFromDateSheet(institute, session, exam, request);
        return toDateSheetResponse(savedDateSheet);
    }

    @Transactional
    public void deleteDateSheet(Long instituteId, Long id) {
        ExamDateSheet dateSheet = examDateSheetRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam date sheet not found with id: " + id));
        if ("PUBLISHED".equalsIgnoreCase(defaultValue(dateSheet.getStatus(), "PUBLISHED"))) {
            dateSheet.setStatus("ARCHIVED");
            examDateSheetRepository.save(dateSheet);
            return;
        }
        examDateSheetRepository.delete(dateSheet);
    }

    public List<ExamQuestionPaperResponse> getQuestionPapers(Long instituteId) {
        return examQuestionPaperRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing(ExamQuestionPaper::getExamTitle, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ExamQuestionPaper::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ExamQuestionPaper::getSubjectName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toQuestionPaperResponse)
                .toList();
    }

    @Transactional
    public ExamQuestionPaperResponse saveQuestionPaper(Long instituteId, ExamQuestionPaperPayload request) {
        return saveQuestionPaper(null, instituteId, request);
    }

    @Transactional
    public ExamQuestionPaperResponse saveQuestionPaper(AuthPrincipal principal, ExamQuestionPaperPayload request) {
        return saveQuestionPaper(principal, principal.instituteId(), request);
    }

    private ExamQuestionPaperResponse saveQuestionPaper(AuthPrincipal principal, Long instituteId, ExamQuestionPaperPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateQuestionPaperPayload(request);
        AcademicSession session = resolveAcademicSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = resolveSchoolClass(instituteId, request.classId(), request.className());
        Subject subject = resolveSubject(instituteId, request.subjectId(), request.subjectName());
        Exam exam = resolveOrCreateExam(institute, session, request.examId(), request.examTitle(), null, null, principal == null ? null : principal.accountId());
        assertTeacherCanUploadPaper(principal, instituteId, session.getId(), schoolClass.getId(), subject.getId());
        ExamQuestionPaper questionPaper = examQuestionPaperRepository
                .findByInstituteIdAndAcademicSessionIdAndExamIdAndSchoolClassIdAndSubjectId(instituteId, session.getId(), exam.getId(), schoolClass.getId(), subject.getId())
                .orElseGet(ExamQuestionPaper::new);
        if (questionPaper.getId() == null) {
            questionPaper.setInstitute(institute);
        }
        questionPaper.setAcademicSession(session);
        questionPaper.setExam(exam);
        questionPaper.setSchoolClass(schoolClass);
        questionPaper.setSubject(subject);
        questionPaper.setUploadedByAccountId(principal == null ? null : principal.accountId());
        if (principal != null && principal.teacherId() != null) {
            teacherRepository.findByInstituteIdAndId(instituteId, principal.teacherId())
                    .ifPresent(questionPaper::setUploadedByTeacher);
        }
        applyQuestionPaperPayload(questionPaper, request);
        return toQuestionPaperResponse(examQuestionPaperRepository.save(questionPaper));
    }

    @Transactional
    public void deleteQuestionPaper(Long instituteId, Long id) {
        ExamQuestionPaper questionPaper = examQuestionPaperRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam question paper not found with id: " + id));
        if (!"DRAFT".equalsIgnoreCase(defaultValue(questionPaper.getStatus(), "DRAFT"))) {
            questionPaper.setStatus("ARCHIVED");
            examQuestionPaperRepository.save(questionPaper);
            return;
        }
        examQuestionPaperRepository.delete(questionPaper);
    }

    public List<ExamAdmitCardResponse> getAdmitCards(Long instituteId) {
        return examAdmitCardRepository.findAllByInstituteIdOrderByExamDateAscCreatedAtDesc(instituteId)
                .stream()
                .map(this::toAdmitCardResponse)
                .toList();
    }

    @Transactional
    public ExamAdmitCardResponse saveAdmitCard(Long instituteId, ExamAdmitCardPayload request) {
        return saveAdmitCard(instituteId, null, request);
    }

    @Transactional
    public ExamAdmitCardResponse saveAdmitCard(Long instituteId, Long accountId, ExamAdmitCardPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateAdmitCardPayload(request);
        AcademicSession session = resolveAcademicSession(instituteId, request.academicSessionId());
        Student student = resolveStudent(instituteId, request.realStudentId(), request.studentId());
        SchoolClass schoolClass = resolveSchoolClass(instituteId, request.classId(), firstNonBlank(request.className(), student.getAssignedClass(), student.getClassName()));
        Exam exam = resolveOrCreateExam(institute, session, request.examId(), request.examTitle(), parseDate(request.examDate(), "examDate", "Exam date must be valid.", new LinkedHashMap<>()), parseDate(request.examDate(), "examDate", "Exam date must be valid.", new LinkedHashMap<>()), accountId);
        ExamAdmitCard admitCard = examAdmitCardRepository.findByInstituteIdAndAcademicSessionIdAndExamIdAndStudent_Id(
                        instituteId,
                        session.getId(),
                        exam.getId(),
                        student.getId()
                )
                .orElseGet(ExamAdmitCard::new);
        if (admitCard.getId() == null) {
            admitCard.setInstitute(institute);
        }
        admitCard.setAcademicSession(session);
        admitCard.setExam(exam);
        admitCard.setStudent(student);
        admitCard.setSchoolClass(schoolClass);
        admitCard.setSection(resolveSection(instituteId, request.sectionId(), schoolClass.getId()));
        admitCard.setGeneratedByAccountId(accountId);
        applyAdmitCardPayload(admitCard, request);
        return toAdmitCardResponse(examAdmitCardRepository.save(admitCard));
    }

    @Transactional
    public List<ExamAdmitCardResponse> generateAdmitCards(Long instituteId, Long accountId, ExamAdmitCardBulkPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateAdmitCardBulkPayload(request);
        AcademicSession session = resolveAcademicSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = resolveSchoolClass(instituteId, request.classId(), request.className());
        Exam exam = resolveOrCreateExam(
                institute,
                session,
                request.examId(),
                request.examTitle(),
                parseDate(request.examDate(), "examDate", "Exam date must be valid.", new LinkedHashMap<>()),
                parseDate(request.examDate(), "examDate", "Exam date must be valid.", new LinkedHashMap<>()),
                accountId
        );
        ClassSection section = resolveSection(instituteId, request.sectionId(), schoolClass.getId());
        String requestedClassName = firstNonBlank(request.className(), schoolClass.getName());
        String requestedSection = section == null ? "" : section.getName();
        List<Student> students = studentRepository.findActiveExamCandidates(
                instituteId,
                schoolClass.getId(),
                requestedClassName,
                parseBaseClass(requestedClassName),
                requestedSection
        );
        if (students.isEmpty()) {
            throw new IllegalArgumentException("NO_STUDENTS_FOUND_FOR_ADMIT_CARD_TARGET");
        }
        Map<Long, ExamAdmitCard> existingCardsByStudentId = examAdmitCardRepository
                .findAllByInstituteIdAndAcademicSessionIdAndExamIdAndStudent_IdIn(
                        instituteId,
                        session.getId(),
                        exam.getId(),
                        students.stream().map(Student::getId).toList()
                )
                .stream()
                .filter(card -> card.getStudent() != null)
                .collect(Collectors.toMap(card -> card.getStudent().getId(), card -> card, (first, second) -> first, LinkedHashMap::new));

        List<ExamAdmitCard> cards = students.stream()
                .map(student -> {
                    ExamAdmitCard admitCard = existingCardsByStudentId.getOrDefault(student.getId(), new ExamAdmitCard());
                    if (admitCard.getId() == null) {
                        admitCard.setInstitute(institute);
                    }
                    admitCard.setAcademicSession(session);
                    admitCard.setExam(exam);
                    admitCard.setStudent(student);
                    admitCard.setSchoolClass(schoolClass);
                    admitCard.setSection(section);
                    admitCard.setGeneratedByAccountId(accountId);
                    admitCard.setExamTitle(exam.getName());
                    admitCard.setStudentId(firstNonBlank(student.getEnrollmentNo(), String.valueOf(student.getId())));
                    admitCard.setStudentName(buildStudentName(student));
                    admitCard.setRollNo(firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), String.valueOf(student.getId())));
                    admitCard.setClassName(schoolClass.getName());
                    admitCard.setCenterName(request.centerName().trim());
                    admitCard.setReportingTime(request.reportingTime().trim());
                    admitCard.setExamDate(request.examDate().trim());
                    admitCard.setStatus(normalizeStatus(request.status(), "GENERATED", List.of("GENERATED", "PUBLISHED", "CANCELLED", "ARCHIVED")));
                    if ("PUBLISHED".equalsIgnoreCase(admitCard.getStatus()) && admitCard.getPublishedAt() == null) {
                        admitCard.setPublishedAt(LocalDateTime.now());
                    }
                    return admitCard;
                })
                .toList();

        return examAdmitCardRepository.saveAll(cards)
                .stream()
                .map(this::toAdmitCardResponse)
                .toList();
    }

    @Transactional
    public void deleteAdmitCard(Long instituteId, Long id) {
        ExamAdmitCard admitCard = examAdmitCardRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam admit card not found with id: " + id));
        if (!"GENERATED".equalsIgnoreCase(defaultValue(admitCard.getStatus(), "GENERATED"))) {
            admitCard.setStatus("ARCHIVED");
            examAdmitCardRepository.save(admitCard);
            return;
        }
        examAdmitCardRepository.delete(admitCard);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void validateDateSheetPayload(ExamDateSheetPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        int shiftCount = parsePositiveInteger(request.shiftsPerDay(), "shiftsPerDay", "Shifts per day must be a valid number.", errors);
        parsePositiveNumber(request.shiftDurationHours(), "shiftDurationHours", "Shift duration must be greater than 0.", errors);

        if (StringUtils.hasText(request.shiftDurationUnit()) && !List.of("hours", "minutes").contains(request.shiftDurationUnit().trim())) {
            errors.put("shiftDurationUnit", "Shift duration unit must be hours or minutes.");
        }

        if (request.shiftStartTimes() == null || request.shiftStartTimes().isEmpty()) {
            errors.put("shiftStartTimes", "Shift start time is required.");
        } else if (shiftCount > 0 && request.shiftStartTimes().size() != shiftCount) {
            errors.put("shiftStartTimes", "Shift start time must be selected for every shift.");
        } else if (request.shiftStartTimes().stream().anyMatch(value -> !StringUtils.hasText(value))) {
            errors.put("shiftStartTimes", "Shift start time must be selected for every shift.");
        }

        LocalDate startDate = parseDate(request.examStartDate(), "examStartDate", "Exam start date must be valid.", errors);
        LocalDate endDate = parseDate(request.examEndDate(), "examEndDate", "Exam end date must be valid.", errors);
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            errors.put("examEndDate", "Exam end date cannot be before start date.");
        }

        throwIfFieldErrors(errors);
    }

    private void validateQuestionPaperPayload(ExamQuestionPaperPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (!StringUtils.hasText(request.fileType())) {
            errors.put("fileType", "File type is required.");
        }
        throwIfFieldErrors(errors);
    }

    private void validateAdmitCardPayload(ExamAdmitCardPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        parseDate(request.examDate(), "examDate", "Exam date must be valid.", errors);
        throwIfFieldErrors(errors);
    }

    private void validateAdmitCardBulkPayload(ExamAdmitCardBulkPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        parseDate(request.examDate(), "examDate", "Exam date must be valid.", errors);
        throwIfFieldErrors(errors);
    }

    private void applyDateSheetPayload(ExamDateSheet dateSheet, ExamDateSheetPayload request) {
        dateSheet.setClassName(request.className().trim());
        dateSheet.setClassFrom(trim(request.classFrom()));
        dateSheet.setClassTo(trim(request.classTo()));
        dateSheet.setSectionWise(Boolean.TRUE.equals(request.sectionWise()));
        dateSheet.setExamType(request.examType().trim());
        dateSheet.setShiftsPerDay(trim(request.shiftsPerDay()));
        dateSheet.setShiftStartTimesJson(writeJson(request.shiftStartTimes() == null ? List.of() : request.shiftStartTimes()));
        dateSheet.setShiftDurationHours(trim(request.shiftDurationHours()));
        dateSheet.setShiftDurationUnit(trim(request.shiftDurationUnit()));
        dateSheet.setExamStartDate(trim(request.examStartDate()));
        dateSheet.setExamEndDate(trim(request.examEndDate()));
        dateSheet.setFileName(request.fileName().trim());
        dateSheet.setFileData(null);
        dateSheet.setFileType(trim(request.fileType()));
        dateSheet.setStatus(normalizeStatus(request.status(), "PUBLISHED", List.of("DRAFT", "PUBLISHED", "ARCHIVED")));
    }

    private void replaceExamSchedulesFromDateSheet(Institute institute, AcademicSession session, Exam exam, ExamDateSheetPayload request) {
        List<String> classColumns = request.classColumns() == null ? List.of(request.className()) : request.classColumns();
        Map<String, String> subjectGrid = request.subjectGrid() == null ? Map.of() : request.subjectGrid();
        if (classColumns.isEmpty() || subjectGrid.isEmpty()) {
            return;
        }

        List<LocalDate> dates = datesBetween(
                parseDate(request.examStartDate(), "examStartDate", "Exam start date must be valid.", new LinkedHashMap<>()),
                parseDate(request.examEndDate(), "examEndDate", "Exam end date must be valid.", new LinkedHashMap<>())
        );
        int shiftCount = Math.max(parsePositiveInteger(request.shiftsPerDay(), "shiftsPerDay", "Shifts per day must be a valid number.", new LinkedHashMap<>()), 1);
        List<String> shiftStartTimes = request.shiftStartTimes() == null ? List.of() : request.shiftStartTimes();
        int durationMinutes = resolveDurationMinutes(request.shiftDurationHours(), request.shiftDurationUnit());

        Set<String> classLookupNames = classColumns.stream()
                .filter(StringUtils::hasText)
                .flatMap(className -> java.util.stream.Stream.of(normalizeName(className), normalizeName(parseBaseClass(className))))
                .collect(Collectors.toSet());
        Map<String, SchoolClass> classesByNormalizedName = classLookupNames.isEmpty()
                ? Map.of()
                : schoolClassRepository.findAllByInstituteIdAndNormalizedNameIn(institute.getId(), classLookupNames)
                        .stream()
                        .collect(Collectors.toMap(SchoolClass::getNormalizedName, schoolClass -> schoolClass, (first, second) -> first, LinkedHashMap::new));
        Set<Long> classIds = classColumns.stream()
                .map(className -> resolveSchoolClassOrNull(classesByNormalizedName, className))
                .filter(Objects::nonNull)
                .map(SchoolClass::getId)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        if (!classIds.isEmpty()) {
            examScheduleRepository.deleteForExamClasses(institute.getId(), session.getId(), exam.getId(), classIds);
        }

        Map<String, Subject> subjectsByNormalizedName = subjectGrid.values().stream()
                .filter(StringUtils::hasText)
                .map(this::normalizeName)
                .collect(Collectors.collectingAndThen(Collectors.toSet(), names -> names.isEmpty()
                        ? Map.of()
                        : subjectRepository.findAllByInstituteIdAndNormalizedNameIn(institute.getId(), names)
                                .stream()
                                .collect(Collectors.toMap(Subject::getNormalizedName, subject -> subject, (first, second) -> first, LinkedHashMap::new))));
        Map<String, ClassSection> sectionsByClassAndName = classIds.isEmpty()
                ? Map.of()
                : classSectionRepository.findAllByInstituteIdOrderBySchoolClassIdAscNameAsc(institute.getId())
                        .stream()
                        .filter(section -> section.getSchoolClass() != null && classIds.contains(section.getSchoolClass().getId()))
                        .collect(Collectors.toMap(
                                section -> sectionKey(section.getSchoolClass().getId(), section.getNormalizedName()),
                                section -> section,
                                (first, second) -> first,
                                LinkedHashMap::new
                        ));

        List<ExamSchedule> schedules = new ArrayList<>();
        for (String classColumn : classColumns) {
            SchoolClass schoolClass = resolveSchoolClassOrNull(classesByNormalizedName, classColumn);
            if (schoolClass == null) continue;
            ClassSection section = resolveSectionFromColumn(sectionsByClassAndName, schoolClass.getId(), classColumn);
            for (LocalDate date : dates) {
                for (int shiftIndex = 0; shiftIndex < shiftCount; shiftIndex++) {
                    String subjectName = subjectGrid.get(buildExamSubjectCellKey(classColumn, date, shiftIndex));
                    if (!StringUtils.hasText(subjectName)) continue;
                    Subject subject = subjectsByNormalizedName.get(normalizeName(subjectName));
                    if (subject == null) continue;
                    ExamSchedule schedule = new ExamSchedule();
                    schedule.setInstitute(institute);
                    schedule.setAcademicSession(session);
                    schedule.setExam(exam);
                    schedule.setSchoolClass(schoolClass);
                    schedule.setSection(section);
                    schedule.setSubject(subject);
                    schedule.setExamDate(date);
                    schedule.setShiftNumber(shiftIndex + 1);
                    schedule.setStartTime(parseLocalTime(shiftStartTimes.size() > shiftIndex ? shiftStartTimes.get(shiftIndex) : null));
                    schedule.setDurationMinutes(durationMinutes);
                    schedule.setStatus(normalizeStatus(request.status(), "PUBLISHED", List.of("DRAFT", "PUBLISHED", "ARCHIVED")));
                    schedules.add(schedule);
                }
            }
        }
        if (!schedules.isEmpty()) {
            examScheduleRepository.saveAll(schedules);
        }
    }

    private List<LocalDate> datesBetween(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            return List.of();
        }
        List<LocalDate> dates = new ArrayList<>();
        LocalDate cursor = startDate;
        while (!cursor.isAfter(endDate)) {
            dates.add(cursor);
            cursor = cursor.plusDays(1);
        }
        return dates;
    }

    private SchoolClass resolveSchoolClassOrNull(Long instituteId, String className) {
        if (!StringUtils.hasText(className)) return null;
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(className))
                .or(() -> schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(parseBaseClass(className))))
                .orElse(null);
    }

    private SchoolClass resolveSchoolClassOrNull(Map<String, SchoolClass> classesByNormalizedName, String className) {
        if (!StringUtils.hasText(className)) return null;
        SchoolClass exact = classesByNormalizedName.get(normalizeName(className));
        return exact != null ? exact : classesByNormalizedName.get(normalizeName(parseBaseClass(className)));
    }

    private ClassSection resolveSectionFromColumn(Map<String, ClassSection> sectionsByClassAndName, Long classId, String classColumn) {
        String sectionName = parseSectionName(classColumn);
        if (!StringUtils.hasText(sectionName)) return null;
        return sectionsByClassAndName.get(sectionKey(classId, normalizeName(sectionName)));
    }

    private String sectionKey(Long classId, String normalizedSectionName) {
        return classId + ":" + normalizedSectionName;
    }

    private String parseSectionName(String value) {
        String clean = defaultValue(value, "");
        int slashIndex = clean.indexOf('/');
        return slashIndex < 0 ? "" : clean.substring(slashIndex + 1).trim();
    }

    private String buildExamSubjectCellKey(String className, LocalDate date, int shiftIndex) {
        return normalizeExamClassLabel(className) + "__" + date + "__" + shiftIndex;
    }

    private String normalizeExamClassLabel(String value) {
        return defaultValue(value, "").trim().toLowerCase().replaceAll("\\s*/\\s*", "/").replaceAll("\\s+", " ");
    }

    private int resolveDurationMinutes(String value, String unit) {
        if (!StringUtils.hasText(value) || !StringUtils.hasText(unit)) return 0;
        try {
            double amount = Double.parseDouble(value.trim());
            return "minutes".equalsIgnoreCase(unit.trim()) ? (int) Math.round(amount) : (int) Math.round(amount * 60);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private LocalTime parseLocalTime(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private void applyQuestionPaperPayload(ExamQuestionPaper questionPaper, ExamQuestionPaperPayload request) {
        questionPaper.setExamTitle(questionPaper.getExam() == null ? request.examTitle().trim() : questionPaper.getExam().getName());
        questionPaper.setClassName(questionPaper.getSchoolClass() == null ? request.className().trim() : questionPaper.getSchoolClass().getName());
        questionPaper.setSubjectName(questionPaper.getSubject() == null ? request.subjectName().trim() : questionPaper.getSubject().getName());
        questionPaper.setUploadedBy(defaultValue(questionPaper.getUploadedByTeacher() == null ? request.uploadedBy() : null, "Teacher"));
        questionPaper.setFileName(request.fileName().trim());
        questionPaper.setFileData(request.fileData().trim());
        questionPaper.setFileType(trim(request.fileType()));
        questionPaper.setStatus(normalizeStatus(request.status(), "DRAFT", List.of("DRAFT", "APPROVED", "RELEASED", "ARCHIVED")));
        questionPaper.setReleaseAt(parseDateTime(request.releaseAt()));
    }

    private void applyAdmitCardPayload(ExamAdmitCard admitCard, ExamAdmitCardPayload request) {
        Student student = admitCard.getStudent();
        admitCard.setExamTitle(admitCard.getExam() == null ? request.examTitle().trim() : admitCard.getExam().getName());
        admitCard.setStudentId(student == null ? request.studentId().trim() : firstNonBlank(student.getEnrollmentNo(), String.valueOf(student.getId())));
        admitCard.setStudentName(student == null ? trim(request.studentName()) : buildStudentName(student));
        admitCard.setRollNo(student == null ? trim(request.rollNo()) : firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), String.valueOf(student.getId())));
        admitCard.setClassName(admitCard.getSchoolClass() == null ? trim(request.className()) : admitCard.getSchoolClass().getName());
        admitCard.setCenterName(request.centerName().trim());
        admitCard.setReportingTime(request.reportingTime().trim());
        admitCard.setExamDate(request.examDate().trim());
        admitCard.setStatus(normalizeStatus(request.status(), "GENERATED", List.of("GENERATED", "PUBLISHED", "CANCELLED", "ARCHIVED")));
        if ("PUBLISHED".equalsIgnoreCase(admitCard.getStatus()) && admitCard.getPublishedAt() == null) {
            admitCard.setPublishedAt(LocalDateTime.now());
        }
    }

    private ExamDateSheetResponse toDateSheetResponse(ExamDateSheet dateSheet) {
        return new ExamDateSheetResponse(
                dateSheet.getId(),
                dateSheet.getAcademicSession() == null ? null : dateSheet.getAcademicSession().getId(),
                dateSheet.getExam() == null ? null : dateSheet.getExam().getId(),
                dateSheet.getSchoolClass() == null ? null : dateSheet.getSchoolClass().getId(),
                dateSheet.getSection() == null ? null : dateSheet.getSection().getId(),
                dateSheet.getClassName(),
                dateSheet.getClassFrom(),
                dateSheet.getClassTo(),
                Boolean.TRUE.equals(dateSheet.getSectionWise()),
                dateSheet.getExamType(),
                dateSheet.getShiftsPerDay(),
                readStringList(dateSheet.getShiftStartTimesJson()),
                dateSheet.getShiftDurationHours(),
                dateSheet.getShiftDurationUnit(),
                dateSheet.getExamStartDate(),
                dateSheet.getExamEndDate(),
                dateSheet.getFileName(),
                dateSheet.getFileData(),
                dateSheet.getFileType(),
                defaultValue(dateSheet.getStatus(), "PUBLISHED"),
                dateSheet.getCreatedAt(),
                dateSheet.getUpdatedAt()
        );
    }

    private ExamQuestionPaperResponse toQuestionPaperResponse(ExamQuestionPaper questionPaper) {
        return new ExamQuestionPaperResponse(
                questionPaper.getId(),
                questionPaper.getAcademicSession() == null ? null : questionPaper.getAcademicSession().getId(),
                questionPaper.getExam() == null ? null : questionPaper.getExam().getId(),
                questionPaper.getSchoolClass() == null ? null : questionPaper.getSchoolClass().getId(),
                questionPaper.getSubject() == null ? null : questionPaper.getSubject().getId(),
                questionPaper.getExamTitle(),
                questionPaper.getClassName(),
                questionPaper.getSubjectName(),
                questionPaper.getUploadedBy(),
                questionPaper.getFileName(),
                questionPaper.getFileData(),
                questionPaper.getFileType(),
                defaultValue(questionPaper.getStatus(), "DRAFT"),
                questionPaper.getReleaseAt() == null ? "" : questionPaper.getReleaseAt().toString(),
                questionPaper.getCreatedAt(),
                questionPaper.getUpdatedAt()
        );
    }

    private ExamAdmitCardResponse toAdmitCardResponse(ExamAdmitCard admitCard) {
        return new ExamAdmitCardResponse(
                admitCard.getId(),
                admitCard.getAcademicSession() == null ? null : admitCard.getAcademicSession().getId(),
                admitCard.getExam() == null ? null : admitCard.getExam().getId(),
                admitCard.getStudent() == null ? null : admitCard.getStudent().getId(),
                admitCard.getSchoolClass() == null ? null : admitCard.getSchoolClass().getId(),
                admitCard.getSection() == null ? null : admitCard.getSection().getId(),
                admitCard.getExamTitle(),
                admitCard.getStudentId(),
                admitCard.getStudentName(),
                admitCard.getRollNo(),
                admitCard.getClassName(),
                admitCard.getCenterName(),
                admitCard.getReportingTime(),
                admitCard.getExamDate(),
                defaultValue(admitCard.getStatus(), "GENERATED"),
                admitCard.getCreatedAt(),
                admitCard.getUpdatedAt()
        );
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
                .or(() -> schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(parseBaseClass(cleanClassName))))
                .orElseThrow(() -> new ResourceNotFoundException("Class master not found: " + cleanClassName));
    }

    private ClassSection resolveSection(Long instituteId, Long sectionId, Long classId) {
        if (sectionId == null) return null;
        ClassSection section = classSectionRepository.findByInstituteIdAndId(instituteId, sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Section not found with id: " + sectionId));
        if (section.getSchoolClass() != null && !section.getSchoolClass().getId().equals(classId)) {
            throw new IllegalArgumentException("SECTION_DOES_NOT_BELONG_TO_CLASS");
        }
        return section;
    }

    private Subject resolveSubject(Long instituteId, Long subjectId, String subjectName) {
        if (subjectId != null) {
            return subjectRepository.findByInstituteIdAndId(instituteId, subjectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Subject not found with id: " + subjectId));
        }
        return subjectRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(cleanRequired(subjectName, "Subject name is required.")))
                .orElseThrow(() -> new ResourceNotFoundException("Subject master not found: " + subjectName));
    }

    private Student resolveStudent(Long instituteId, Long studentId, String legacyStudentToken) {
        if (studentId != null) {
            return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
        }
        if (StringUtils.hasText(legacyStudentToken)) {
            return studentRepository.findByInstituteIdAndEnrollmentNoIgnoreCase(instituteId, legacyStudentToken.trim())
                    .or(() -> {
                        try {
                            return studentRepository.findByInstituteIdAndId(instituteId, Long.parseLong(legacyStudentToken.trim()));
                        } catch (NumberFormatException ignored) {
                            return java.util.Optional.empty();
                        }
                    })
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + legacyStudentToken));
        }
        throw new IllegalArgumentException("Student is required.");
    }

    private Exam resolveOrCreateExam(Institute institute, AcademicSession session, Long examId, String title, LocalDate startDate, LocalDate endDate, Long accountId) {
        if (examId != null) {
            return examRepository.findByInstituteIdAndId(institute.getId(), examId)
                    .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));
        }
        String name = cleanRequired(title, "Exam title is required.");
        LocalDate identityDate = startDate == null ? LocalDate.of(1970, 1, 1) : startDate;
        return examRepository.findByInstituteIdAndAcademicSessionIdAndNormalizedNameAndExamTypeAndStartDate(
                        institute.getId(),
                        session.getId(),
                        normalizeName(name),
                        name,
                        identityDate
                )
                .orElseGet(() -> {
                    Exam exam = new Exam();
                    exam.setInstitute(institute);
                    exam.setAcademicSession(session);
                    exam.setName(name);
                    exam.setNormalizedName(normalizeName(name));
                    exam.setExamType(name);
                    exam.setStartDate(identityDate);
                    exam.setEndDate(endDate);
                    exam.setStatus("SCHEDULED");
                    exam.setCreatedByAccountId(accountId);
                    return examRepository.save(exam);
                });
    }

    private Long resolveStudentClass(Student student, Long instituteId, String className) {
        if (student.getSchoolClass() != null) {
            return student.getSchoolClass().getId();
        }
        if (!StringUtils.hasText(className)) return null;
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(className))
                .or(() -> schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeName(parseBaseClass(className))))
                .map(SchoolClass::getId)
                .orElse(null);
    }

    private Long resolveStudentSection(Long instituteId, Long classId, String sectionName, String className) {
        if (classId == null) return null;
        String resolvedSection = firstNonBlank(sectionName, parseSectionName(className));
        if (!StringUtils.hasText(resolvedSection)) return null;
        return classSectionRepository.findByInstituteIdAndSchoolClassIdAndNormalizedName(instituteId, classId, normalizeName(resolvedSection))
                .map(ClassSection::getId)
                .orElse(null);
    }

    private void assertTeacherCanUploadPaper(AuthPrincipal principal, Long instituteId, Long academicSessionId, Long classId, Long subjectId) {
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
            throw new IllegalArgumentException("TEACHER_NOT_ASSIGNED_TO_CLASS_SUBJECT");
        }
    }

    private int parsePositiveInteger(String value, String fieldName, String message, Map<String, String> errors) {
        if (!StringUtils.hasText(value)) {
            return 0;
        }
        try {
            int parsedValue = Integer.parseInt(value.trim());
            if (parsedValue <= 0) {
                errors.put(fieldName, message);
                return 0;
            }
            return parsedValue;
        } catch (NumberFormatException exception) {
            errors.put(fieldName, message);
            return 0;
        }
    }

    private void parsePositiveNumber(String value, String fieldName, String message, Map<String, String> errors) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        try {
            double parsedValue = Double.parseDouble(value.trim());
            if (parsedValue <= 0) {
                errors.put(fieldName, message);
            }
        } catch (NumberFormatException exception) {
            errors.put(fieldName, message);
        }
    }

    private LocalDate parseDate(String value, String fieldName, String message, Map<String, String> errors) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException exception) {
            errors.put(fieldName, message);
            return null;
        }
    }

    private void throwIfFieldErrors(Map<String, String> errors) {
        if (!errors.isEmpty()) {
            throw new FieldValidationException("Please fix the highlighted examination fields.", errors);
        }
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String blankToEmpty(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
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

    private String normalizeStatus(String value, String fallback, List<String> supported) {
        String status = StringUtils.hasText(value) ? value.trim().toUpperCase() : fallback;
        if (!supported.contains(status)) {
            throw new IllegalArgumentException("UNSUPPORTED_EXAMINATION_STATUS");
        }
        return status;
    }

    private LocalDateTime parseDateTime(String value) {
        if (!StringUtils.hasText(value)) return null;
        return LocalDateTime.parse(value.trim());
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) return value.trim();
        }
        return null;
    }

    private String buildStudentName(Student student) {
        return firstNonBlank(
                String.join(" ", defaultValue(student.getFirstName(), ""), defaultValue(student.getLastName(), "")).trim(),
                student.getName(),
                student.getEnrollmentNo(),
                "Student"
        );
    }

    private String parseBaseClass(String value) {
        String clean = defaultValue(value, "");
        int slashIndex = clean.indexOf('/');
        return slashIndex < 0 ? clean.trim() : clean.substring(0, slashIndex).trim();
    }

    private boolean doesDateSheetMatchClass(ExamDateSheet dateSheet, String className, String baseClassName) {
        String recordClass = defaultValue(dateSheet.getClassName(), "");
        if (recordClass.equalsIgnoreCase(className) || recordClass.equalsIgnoreCase(baseClassName)) {
            return true;
        }
        if (!StringUtils.hasText(dateSheet.getClassFrom()) || !StringUtils.hasText(dateSheet.getClassTo())) {
            return false;
        }
        int target = classRank(baseClassName);
        int start = classRank(dateSheet.getClassFrom());
        int end = classRank(dateSheet.getClassTo());
        return target >= Math.min(start, end) && target <= Math.max(start, end);
    }

    private int classRank(String value) {
        String normalized = defaultValue(value, "").toLowerCase();
        if (normalized.contains("nursery")) return 0;
        if (normalized.contains("lkg")) return 1;
        if (normalized.contains("ukg")) return 2;
        String digits = normalized.replaceAll("\\D+", "");
        return digits.isBlank() ? 1000 : 10 + Integer.parseInt(digits);
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to save examination JSON data.", exception);
        }
    }

    private List<String> readStringList(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of();
        }

        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read examination JSON data.", exception);
        }
    }
}
