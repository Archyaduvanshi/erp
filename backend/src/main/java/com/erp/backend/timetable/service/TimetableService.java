package com.erp.backend.timetable.service;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.entity.ClassSection;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.curriculum.repository.ClassSectionRepository;
import com.erp.backend.curriculum.repository.ClassSubjectRepository;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.timetable.dto.ClassTimetablePayload;
import com.erp.backend.timetable.dto.ClassTimetableResponse;
import com.erp.backend.timetable.dto.DraftRecordSummary;
import com.erp.backend.timetable.dto.TimetableClassSummaryResponse;
import com.erp.backend.timetable.dto.TimetablePeriodCandidate;
import com.erp.backend.timetable.dto.TimetablePeriodProjection;
import com.erp.backend.timetable.dto.TeacherOccupancyResponse;
import com.erp.backend.timetable.dto.TeacherTimetableResponse;
import com.erp.backend.timetable.dto.TimetablePeriodResponse;
import com.erp.backend.timetable.dto.TimetableRecordSummary;
import com.erp.backend.timetable.dto.TimetableTemplateDraftPayload;
import com.erp.backend.timetable.dto.TimetableTemplateDraftResponse;
import com.erp.backend.timetable.entity.ClassTimetable;
import com.erp.backend.timetable.entity.TimetablePeriod;
import com.erp.backend.timetable.entity.TimetableTemplateDraft;
import com.erp.backend.timetable.repository.ClassTimetableRepository;
import com.erp.backend.timetable.repository.TimetablePeriodRepository;
import com.erp.backend.timetable.repository.TimetableTemplateDraftRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TimetableService {
    private static final Pattern LEADING_CLASS_NUMBER = Pattern.compile("^(?:class\\s*)?(\\d{1,2})(?:\\b|\\s|/)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CLASS_SECTION_DASH_LABEL = Pattern.compile("^(.+?)\\s*-\\s*([A-Za-z0-9]+)$");

    private final InstituteRepository instituteRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final ClassSectionRepository classSectionRepository;
    private final ClassSubjectRepository classSubjectRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final ClassTimetableRepository classTimetableRepository;
    private final TimetablePeriodRepository timetablePeriodRepository;
    private final TimetableTemplateDraftRepository timetableTemplateDraftRepository;
    private final TimetableValidator timetableValidator;
    private final ObjectMapper objectMapper;

    public TimetableService(
            InstituteRepository instituteRepository,
            AcademicSessionRepository academicSessionRepository,
            SchoolClassRepository schoolClassRepository,
            ClassSectionRepository classSectionRepository,
            ClassSubjectRepository classSubjectRepository,
            TeacherRepository teacherRepository,
            StudentRepository studentRepository,
            ClassTimetableRepository classTimetableRepository,
            TimetablePeriodRepository timetablePeriodRepository,
            TimetableTemplateDraftRepository timetableTemplateDraftRepository,
            TimetableValidator timetableValidator,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.classSectionRepository = classSectionRepository;
        this.classSubjectRepository = classSubjectRepository;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
        this.classTimetableRepository = classTimetableRepository;
        this.timetablePeriodRepository = timetablePeriodRepository;
        this.timetableTemplateDraftRepository = timetableTemplateDraftRepository;
        this.timetableValidator = timetableValidator;
        this.objectMapper = objectMapper;
    }

    public List<ClassTimetableResponse> getClassTimetables(Long instituteId) {
        validateInstitute(instituteId);
        return classTimetableRepository.findAllByInstituteIdOrderByClassNameAsc(instituteId)
                .stream()
                .map(this::toClassTimetableResponse)
                .toList();
    }

    public TeacherTimetableResponse getTeacherTimetable(Long instituteId, Long teacherId, Long academicSessionId) {
        validateTeacher(instituteId, teacherId);
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        return new TeacherTimetableResponse(
                teacherId,
                timetablePeriodRepository.findTeacherPeriodProjections(instituteId, session.getId(), teacherId)
                        .stream()
                        .map(this::toPeriodResponse)
                        .toList()
        );
    }

    public TeacherOccupancyResponse getTeacherOccupancy(Long instituteId, Long academicSessionId) {
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        Map<Long, List<TimetablePeriodResponse>> teachers = timetablePeriodRepository.findOccupancyProjections(instituteId, session.getId())
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        TimetablePeriodProjection::teacherId,
                        LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(this::toPeriodResponse, java.util.stream.Collectors.toList())
                ));
        return new TeacherOccupancyResponse(teachers);
    }

    public ClassTimetableResponse getStudentTimetable(Long instituteId, Long studentId, Long academicSessionId) {
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        Student student = studentRepository.findByInstituteIdAndIdWithClassAndSection(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
        StudentTimetableTarget target = resolveStudentTimetableTarget(instituteId, student);
        return findStudentClassTimetable(instituteId, session.getId(), target.schoolClass().getId(), target.section() == null ? null : target.section().getId())
                .map(this::toClassTimetableResponse)
                .orElse(null);
    }

    public List<TimetableClassSummaryResponse> getTimetableSummaries(Long instituteId) {
        return getTimetableSummaries(instituteId, null);
    }

    public List<TimetableClassSummaryResponse> getTimetableSummaries(Long instituteId, Long academicSessionId) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        Map<String, TimetableRecordSummary> timetableByTarget = classTimetableRepository.findRecordSummaries(instituteId, session.getId())
                .stream()
                .collect(LinkedHashMap::new, (map, row) -> map.put(targetKey(row.classId(), row.sectionId()), row), Map::putAll);
        Map<String, DraftRecordSummary> draftByTarget = timetableTemplateDraftRepository.findRecordSummaries(instituteId, session.getId())
                .stream()
                .collect(LinkedHashMap::new, (map, row) -> map.put(targetKey(row.classId(), row.sectionId()), row), Map::putAll);

        List<SchoolClass> schoolClasses = schoolClassRepository.findAllByInstituteIdOrderByNameAsc(instituteId);
        Map<Long, List<ClassSection>> sectionsByClassId = classSectionRepository.findAllByInstituteIdOrderBySchoolClassIdAscNameAsc(instituteId)
                .stream()
                .filter(section -> !"ARCHIVED".equalsIgnoreCase(section.getStatus()))
                .collect(java.util.stream.Collectors.groupingBy(
                        section -> section.getSchoolClass().getId(),
                        LinkedHashMap::new,
                        java.util.stream.Collectors.toList()
                ));
        java.util.Set<String> classNamesWithSections = schoolClasses.stream()
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(schoolClass.getStatus()))
                .filter(schoolClass -> sectionsByClassId.getOrDefault(schoolClass.getId(), List.of()).isEmpty())
                .map(SchoolClass::getName)
                .filter(this::hasSection)
                .map(this::baseClassKey)
                .filter(StringUtils::hasText)
                .collect(java.util.stream.Collectors.toSet());
        sectionsByClassId.forEach((classId, sections) -> {
            if (!sections.isEmpty()) {
                schoolClasses.stream()
                        .filter(schoolClass -> schoolClass.getId().equals(classId))
                        .findFirst()
                        .map(SchoolClass::getName)
                        .map(this::baseClassKey)
                        .filter(StringUtils::hasText)
                        .ifPresent(classNamesWithSections::add);
            }
        });
        return schoolClasses.stream()
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(schoolClass.getStatus()))
                .filter(schoolClass -> !sectionsByClassId.getOrDefault(schoolClass.getId(), List.of()).isEmpty()
                        || hasSection(schoolClass.getName())
                        || !classNamesWithSections.contains(baseClassKey(schoolClass.getName())))
                .flatMap(schoolClass -> {
                    List<ClassSection> sections = sectionsByClassId.getOrDefault(schoolClass.getId(), List.of());
                    if (sections.isEmpty()) {
                        return java.util.stream.Stream.of(toSummary(session, schoolClass, null, timetableByTarget, draftByTarget));
                    }
                    return sections.stream().map(section -> toSummary(session, schoolClass, section, timetableByTarget, draftByTarget));
                })
                .sorted(Comparator.comparing(TimetableClassSummaryResponse::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public ClassTimetableResponse getClassTimetable(Long instituteId, Long classId) {
        return getClassTimetable(instituteId, classId, null, null);
    }

    public ClassTimetableResponse getClassTimetable(Long instituteId, Long classId, Long academicSessionId, Long sectionId) {
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        SchoolClass schoolClass = validateClass(instituteId, classId);
        ClassSection section = validateSection(instituteId, schoolClass.getId(), sectionId);
        return findClassTimetableByIdentity(instituteId, session.getId(), schoolClass.getId(), sectionId)
                .map(this::toClassTimetableResponse)
                .orElse(null);
    }

    public TimetableTemplateDraftResponse getTemplateDraft(Long instituteId, Long classId) {
        return getTemplateDraft(instituteId, classId, null, null);
    }

    public TimetableTemplateDraftResponse getTemplateDraft(Long instituteId, Long classId, Long academicSessionId, Long sectionId) {
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        SchoolClass schoolClass = validateClass(instituteId, classId);
        ClassSection section = validateSection(instituteId, schoolClass.getId(), sectionId);
        return findTemplateDraftByIdentity(instituteId, session.getId(), schoolClass.getId(), sectionId)
                .map(this::toTemplateDraftResponse)
                .orElse(null);
    }

    @Transactional
    public TimetableTemplateDraftResponse saveTemplateDraft(Long instituteId, Long classId, TimetableTemplateDraftPayload request) {
        return saveTemplateDraft(instituteId, classId, request.academicSessionId(), request.sectionId(), request);
    }

    @Transactional
    public TimetableTemplateDraftResponse saveTemplateDraft(Long instituteId, Long classId, Long academicSessionId, Long sectionId, TimetableTemplateDraftPayload request) {
        AcademicSession session = resolveSession(instituteId, academicSessionId);
        Institute institute = validateInstitute(instituteId);
        SchoolClass schoolClass = validateClass(instituteId, classId);
        ClassSection section = validateSection(instituteId, schoolClass.getId(), sectionId);
        TimetableTemplateDraft draft = findTemplateDraftByIdentity(instituteId, session.getId(), schoolClass.getId(), sectionId)
                .orElseGet(TimetableTemplateDraft::new);
        if (draft.getId() == null) {
            draft.setInstitute(institute);
        }
        draft.setAcademicSession(session);
        draft.setSchoolClass(schoolClass);
        draft.setSection(section);
        draft.setClassName(displayName(schoolClass, section));
        draft.setDraftDataJson(writeJson(request.draftData()));
        return toTemplateDraftResponse(timetableTemplateDraftRepository.save(draft));
    }

    @Transactional
    public ClassTimetableResponse publishClassTimetable(Long instituteId, Long classId, ClassTimetablePayload request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = validateClass(instituteId, classId);
        ClassSection section = validateSection(instituteId, schoolClass.getId(), request.sectionId());
        Teacher attendanceTeacher = validateTeacher(instituteId, request.attendanceTeacherId());
        ClassTimetableResponse saved = saveResolvedClassTimetable(instituteId, institute, session, schoolClass, section, attendanceTeacher, new ClassTimetablePayload(
                session.getId(),
                schoolClass.getId(),
                section == null ? null : section.getId(),
                request.attendanceTeacherId(),
                displayName(schoolClass, section),
                request.fileName(),
                null,
                request.fileType(),
                request.uploadedAt(),
                request.templateData(),
                request.templateMeta()
        ));
        findTemplateDraftByIdentity(instituteId, session.getId(), schoolClass.getId(), section == null ? null : section.getId())
                .ifPresent(timetableTemplateDraftRepository::delete);
        return saved;
    }

    @Transactional
    public ClassTimetableResponse saveClassTimetable(Long instituteId, ClassTimetablePayload request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = request.classId() == null ? resolveClassFromName(instituteId, request.className()) : validateClass(instituteId, request.classId());
        ClassSection section = validateSection(instituteId, schoolClass.getId(), request.sectionId());
        Teacher attendanceTeacher = validateTeacher(instituteId, request.attendanceTeacherId());
        return saveResolvedClassTimetable(instituteId, institute, session, schoolClass, section, attendanceTeacher, request);
    }

    private ClassTimetableResponse saveResolvedClassTimetable(
            Long instituteId,
            Institute institute,
            AcademicSession session,
            SchoolClass schoolClass,
            ClassSection section,
            Teacher attendanceTeacher,
            ClassTimetablePayload request
    ) {
        String className = displayName(schoolClass, section);
        ClassTimetable timetable = findClassTimetableByIdentity(instituteId, session.getId(), schoolClass.getId(), section == null ? null : section.getId())
                .orElseGet(ClassTimetable::new);
        List<TimetablePeriodCandidate> periodCandidates = extractPeriodCandidates(request.templateData());
        List<ResolvedTimetablePeriod> resolvedPeriods = List.of();
        if (request.templateData() != null) {
            resolvedPeriods = timetableValidator.validatePublish(instituteId, session, schoolClass, section, periodCandidates, timetable.getId());
        }

        if (timetable.getId() == null) {
            timetable.setInstitute(institute);
        }
        timetable.setAcademicSession(session);
        timetable.setSchoolClass(schoolClass);
        timetable.setSection(section);
        timetable.setAttendanceTeacher(attendanceTeacher);

        ClassTimetablePayload effectiveRequest = new ClassTimetablePayload(
                session.getId(),
                schoolClass.getId(),
                section == null ? null : section.getId(),
                request.attendanceTeacherId(),
                className,
                request.fileName(),
                request.fileData(),
                request.fileType(),
                request.uploadedAt(),
                request.templateData(),
                request.templateMeta()
        );
        applyClassTimetablePayload(timetable, effectiveRequest);
        ClassTimetable saved = classTimetableRepository.save(timetable);
        if (request.templateData() != null) {
            replaceTimetablePeriods(saved, resolvedPeriods);
        }
        return toClassTimetableResponse(saved);
    }

    @Transactional
    public void deleteClassTimetable(Long instituteId, Long timetableId) {
        ClassTimetable timetable = classTimetableRepository.findByInstituteIdAndId(instituteId, timetableId)
                .orElseThrow(() -> new ResourceNotFoundException("Class timetable not found with id: " + timetableId));
        classTimetableRepository.delete(timetable);
    }

    public List<TimetableTemplateDraftResponse> getTemplateDrafts(Long instituteId) {
        validateInstitute(instituteId);
        return timetableTemplateDraftRepository.findAllByInstituteIdOrderByClassNameAsc(instituteId)
                .stream()
                .map(this::toTemplateDraftResponse)
                .toList();
    }

    @Transactional
    public TimetableTemplateDraftResponse saveTemplateDraft(Long instituteId, TimetableTemplateDraftPayload request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(instituteId, request.academicSessionId());
        SchoolClass schoolClass = request.classId() == null ? resolveClassFromName(instituteId, request.className()) : validateClass(instituteId, request.classId());
        ClassSection section = validateSection(instituteId, schoolClass.getId(), request.sectionId());
        String className = displayName(schoolClass, section);
        TimetableTemplateDraft draft = findTemplateDraftByIdentity(instituteId, session.getId(), schoolClass.getId(), section == null ? null : section.getId())
                .orElseGet(TimetableTemplateDraft::new);

        if (draft.getId() == null) {
            draft.setInstitute(institute);
        }

        draft.setAcademicSession(session);
        draft.setSchoolClass(schoolClass);
        draft.setSection(section);
        draft.setClassName(className);
        draft.setDraftDataJson(writeJson(request.draftData()));
        return toTemplateDraftResponse(timetableTemplateDraftRepository.save(draft));
    }

    @Transactional
    public void deleteTemplateDraft(Long instituteId, Long draftId) {
        TimetableTemplateDraft draft = timetableTemplateDraftRepository.findByInstituteIdAndId(instituteId, draftId)
                .orElseThrow(() -> new ResourceNotFoundException("Timetable draft not found with id: " + draftId));
        timetableTemplateDraftRepository.delete(draft);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private SchoolClass validateClass(Long instituteId, Long classId) {
        validateInstitute(instituteId);
        return schoolClassRepository.findByInstituteIdAndId(instituteId, classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found with id: " + classId));
    }

    private AcademicSession resolveSession(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            return academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Academic session not found with id: " + academicSessionId));
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .or(() -> academicSessionRepository.findAllByInstituteIdOrderByCurrentDescNameDesc(instituteId).stream().findFirst())
                .orElseThrow(() -> new ResourceNotFoundException("Academic session is not configured."));
    }

    private SchoolClass resolveClassFromName(Long instituteId, String className) {
        String cleanName = cleanRequired(canonicalSubjectClassName(className), "Class name is required.");
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeKey(cleanName))
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(schoolClass.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Class not found: " + cleanName));
    }

    private ClassSection validateSection(Long instituteId, Long classId, Long sectionId) {
        if (sectionId == null) {
            return null;
        }
        ClassSection section = classSectionRepository.findByInstituteIdAndId(instituteId, sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Class section not found with id: " + sectionId));
        if (!section.getSchoolClass().getId().equals(classId)) {
            throw new IllegalArgumentException("Section does not belong to the selected class.");
        }
        return section;
    }

    private Teacher validateTeacher(Long instituteId, Long teacherId) {
        if (teacherId == null) {
            return null;
        }
        return teacherRepository.findByInstituteIdAndId(instituteId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherId));
    }

    private StudentTimetableTarget resolveStudentTimetableTarget(Long instituteId, Student student) {
        StudentTimetableTarget stableTarget = resolveStableStudentTimetableTarget(instituteId, student);
        if (stableTarget != null) {
            return stableTarget;
        }

        StudentClassSectionLabel label = parseStudentClassSectionLabel(
                StringUtils.hasText(student.getAssignedClass()) ? student.getAssignedClass() : displayStudentClassName(student),
                student.getSection()
        );
        SchoolClass schoolClass = resolveClassFromName(instituteId, label.className());
        ClassSection section = null;
        String sectionName = label.sectionName();
        if (StringUtils.hasText(sectionName)) {
            section = classSectionRepository.findByInstituteIdAndSchoolClassIdAndNormalizedName(instituteId, schoolClass.getId(), normalizeKey(sectionName))
                    .orElse(null);
        }
        return new StudentTimetableTarget(schoolClass, section);
    }

    private StudentTimetableTarget resolveStableStudentTimetableTarget(Long instituteId, Student student) {
        if (student.getSchoolClass() == null) {
            return null;
        }
        SchoolClass schoolClass = schoolClassRepository.findByInstituteIdAndId(instituteId, student.getSchoolClass().getId())
                .filter(candidate -> !"ARCHIVED".equalsIgnoreCase(candidate.getStatus()))
                .orElse(null);
        if (schoolClass == null) {
            return null;
        }
        ClassSection section = null;
        if (student.getClassSection() != null) {
            section = classSectionRepository.findByInstituteIdAndId(instituteId, student.getClassSection().getId())
                    .filter(candidate -> candidate.getSchoolClass().getId().equals(schoolClass.getId()))
                    .filter(candidate -> !"ARCHIVED".equalsIgnoreCase(candidate.getStatus()))
                    .orElse(null);
        }
        return new StudentTimetableTarget(schoolClass, section);
    }

    private StudentClassSectionLabel parseStudentClassSectionLabel(String classLabel, String fallbackSection) {
        String cleanLabel = String.valueOf(classLabel == null ? "" : classLabel).trim();
        String className = cleanLabel;
        String sectionName = fallbackSection;
        String[] slashParts = cleanLabel.split("/", 2);
        if (slashParts.length == 2) {
            className = slashParts[0].trim();
            sectionName = slashParts[1].trim();
        } else if (!StringUtils.hasText(fallbackSection)) {
            Matcher matcher = CLASS_SECTION_DASH_LABEL.matcher(cleanLabel);
            if (matcher.matches()) {
                className = matcher.group(1).trim();
                sectionName = matcher.group(2).trim();
            }
        }
        return new StudentClassSectionLabel(canonicalSubjectClassName(className), sectionName);
    }

    private String displayStudentClassName(Student student) {
        if (StringUtils.hasText(student.getClassName()) && StringUtils.hasText(student.getSection())) {
            return student.getClassName() + " / " + student.getSection();
        }
        return student.getClassName();
    }

    private record StudentTimetableTarget(SchoolClass schoolClass, ClassSection section) {
    }

    private record StudentClassSectionLabel(String className, String sectionName) {
    }

    private String normalizeTimetableClassKey(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase().replaceAll("\\s*\\/\\s*", "/").replaceAll("\\s+", " ") : "";
    }

    private SchoolClass resolveSubjectClass(Long instituteId, SchoolClass timetableClass) {
        String subjectClassName = canonicalSubjectClassName(timetableClass.getName());
        if (!StringUtils.hasText(subjectClassName) || normalizeTimetableClassKey(subjectClassName).equals(normalizeTimetableClassKey(timetableClass.getName()))) {
            return timetableClass;
        }
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeKey(subjectClassName))
                .filter(Predicate.not(subjectClass -> "ARCHIVED".equalsIgnoreCase(subjectClass.getStatus())))
                .orElse(timetableClass);
    }

    private String canonicalSubjectClassName(String value) {
        String cleanName = StringUtils.hasText(value) ? value.trim() : "";
        Integer classNumber = extractLeadingClassNumber(cleanName);
        if (classNumber != null && classNumber >= 1 && classNumber <= 8) {
            return cleanName.split("/", 2)[0].trim();
        }
        return cleanName;
    }

    private boolean isLowerSectionClass(String value) {
        Integer classNumber = extractLeadingClassNumber(value);
        return classNumber != null && classNumber >= 1 && classNumber <= 8 && hasSection(value);
    }

    private boolean hasSection(String value) {
        String[] parts = String.valueOf(value == null ? "" : value).split("/", 2);
        return parts.length == 2 && StringUtils.hasText(parts[0]) && StringUtils.hasText(parts[1]);
    }

    private String baseClassKey(String value) {
        return normalizeTimetableClassKey(String.valueOf(value == null ? "" : value).split("/", 2)[0]);
    }

    private Integer extractLeadingClassNumber(String value) {
        Matcher matcher = LEADING_CLASS_NUMBER.matcher(String.valueOf(value == null ? "" : value).trim());
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : null;
    }

    private String normalizeKey(String value) {
        return String.valueOf(value == null ? "" : value).trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private Optional<ClassTimetable> findClassTimetableByIdentity(Long instituteId, Long academicSessionId, Long classId, Long sectionId) {
        return sectionId == null
                ? classTimetableRepository.findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionIsNull(instituteId, academicSessionId, classId)
                : classTimetableRepository.findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionId(instituteId, academicSessionId, classId, sectionId);
    }

    private Optional<ClassTimetable> findStudentClassTimetable(Long instituteId, Long academicSessionId, Long classId, Long sectionId) {
        Optional<ClassTimetable> exactMatch = findClassTimetableByIdentity(instituteId, academicSessionId, classId, sectionId);
        if (exactMatch.isPresent() || sectionId == null) {
            return exactMatch;
        }
        return findClassTimetableByIdentity(instituteId, academicSessionId, classId, null);
    }

    private Optional<TimetableTemplateDraft> findTemplateDraftByIdentity(Long instituteId, Long academicSessionId, Long classId, Long sectionId) {
        return sectionId == null
                ? timetableTemplateDraftRepository.findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionIsNull(instituteId, academicSessionId, classId)
                : timetableTemplateDraftRepository.findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSectionId(instituteId, academicSessionId, classId, sectionId);
    }

    private TimetableClassSummaryResponse toSummary(
            AcademicSession session,
            SchoolClass schoolClass,
            ClassSection section,
            Map<String, TimetableRecordSummary> timetableByTarget,
            Map<String, DraftRecordSummary> draftByTarget
    ) {
        SchoolClass subjectClass = resolveSubjectClass(schoolClass.getInstitute().getId(), schoolClass);
        String key = targetKey(schoolClass, section);
        TimetableRecordSummary timetable = timetableByTarget.get(key);
        DraftRecordSummary draft = draftByTarget.get(key);
        return new TimetableClassSummaryResponse(
                session.getId(),
                schoolClass.getId(),
                schoolClass.getName(),
                section == null ? null : section.getId(),
                section == null ? null : section.getName(),
                displayName(schoolClass, section),
                subjectClass.getId(),
                subjectClass.getName(),
                timetable == null ? null : timetable.id(),
                timetable != null,
                draft == null ? null : draft.id(),
                draft != null,
                latest(timetable == null ? null : timetable.updatedAt(), draft == null ? null : draft.updatedAt())
        );
    }

    private String targetKey(SchoolClass schoolClass, ClassSection section) {
        if (schoolClass == null) {
            return "";
        }
        return schoolClass.getId() + ":" + (section == null ? "none" : section.getId());
    }

    private String targetKey(Long classId, Long sectionId) {
        if (classId == null) {
            return "";
        }
        return classId + ":" + (sectionId == null ? "none" : sectionId);
    }

    private String displayName(SchoolClass schoolClass, ClassSection section) {
        return section == null ? schoolClass.getName() : schoolClass.getName() + " / " + section.getName();
    }

    private String cleanRequired(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private LocalDateTime latest(LocalDateTime first, LocalDateTime second) {
        if (first == null) {
            return second;
        }
        if (second == null) {
            return first;
        }
        return first.isAfter(second) ? first : second;
    }

    private List<TimetablePeriodCandidate> extractPeriodCandidates(Object templateData) {
        if (templateData == null) {
            return List.of();
        }
        Map<String, Object> template = objectMapper.convertValue(templateData, new TypeReference<Map<String, Object>>() {
        });
        List<Map<String, Object>> lecturePlan = readObjectList(template.get("lecturePlan"));
        List<Map<String, Object>> rows = readObjectList(template.get("rows"));
        List<TimetablePeriodCandidate> periods = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            String dayOfWeek = trimToNull(row.get("day"));
            List<Map<String, Object>> slots = readObjectList(row.get("slots"));
            for (int index = 0; index < Math.min(lecturePlan.size(), slots.size()); index++) {
                Map<String, Object> lecture = lecturePlan.get(index);
                Map<String, Object> slot = slots.get(index);
                Long classSubjectId = readLong(slot.get("classSubjectId"));
                Long teacherId = readLong(slot.get("teacherId"));
                String subjectName = trimToNull(slot.get("subjectName"));
                String teacherName = trimToNull(slot.get("teacherName"));
                boolean hasAssignment = classSubjectId != null || teacherId != null || StringUtils.hasText(subjectName) || StringUtils.hasText(teacherName);
                if (!hasAssignment) {
                    continue;
                }
                periods.add(new TimetablePeriodCandidate(
                        normalizeDay(dayOfWeek),
                        readInteger(lecture.get("lectureNumber"), index + 1),
                        parseTime(lecture.get("timeFrom")),
                        parseTime(lecture.get("timeTo")),
                        classSubjectId,
                        subjectName,
                        teacherId,
                        teacherName
                ));
            }
        }
        return periods;
    }

    private void replaceTimetablePeriods(ClassTimetable timetable, List<ResolvedTimetablePeriod> resolvedPeriods) {
        if (timetable.getId() == null) {
            return;
        }
        timetablePeriodRepository.deleteAllByTimetableId(timetable.getId());
        List<TimetablePeriod> periods = resolvedPeriods.stream().map(candidate -> {
            TimetablePeriod period = new TimetablePeriod();
            period.setTimetable(timetable);
            period.setDayOfWeek(candidate.dayOfWeek());
            period.setPeriodNumber(candidate.periodNumber());
            period.setStartTime(candidate.startTime());
            period.setEndTime(candidate.endTime());
            period.setClassSubject(candidate.classSubject());
            period.setTeacher(candidate.teacher());
            return period;
        }).toList();
        timetablePeriodRepository.saveAll(periods);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readObjectList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .filter(Map.class::isInstance)
                .map(item -> (Map<String, Object>) item)
                .toList();
    }

    private String trimToNull(Object value) {
        String text = value == null ? "" : String.valueOf(value).trim();
        return StringUtils.hasText(text) ? text : null;
    }

    private Long readLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        String text = trimToNull(value);
        if (!StringUtils.hasText(text)) {
            return null;
        }
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Integer readInteger(Object value, Integer fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        String text = trimToNull(value);
        if (!StringUtils.hasText(text)) {
            return fallback;
        }
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private LocalTime parseTime(Object value) {
        String text = trimToNull(value);
        if (!StringUtils.hasText(text)) {
            return null;
        }
        return LocalTime.parse(text);
    }

    private String normalizeDay(String value) {
        String day = cleanRequired(value, "Day is required.").trim().toUpperCase();
        return switch (day) {
            case "MONDAY" -> "MONDAY";
            case "TUESDAY" -> "TUESDAY";
            case "WEDNESDAY" -> "WEDNESDAY";
            case "THURSDAY" -> "THURSDAY";
            case "FRIDAY" -> "FRIDAY";
            case "SATURDAY" -> "SATURDAY";
            case "SUNDAY" -> "SUNDAY";
            default -> throw new IllegalArgumentException("Invalid timetable day: " + value);
        };
    }

    private void applyClassTimetablePayload(ClassTimetable timetable, ClassTimetablePayload request) {
        timetable.setClassName(cleanRequired(request.className(), "Class name is required."));
        timetable.setStatus("PUBLISHED");
        timetable.setPublishedAt(LocalDateTime.now());
        timetable.setFileName(trim(request.fileName()));
        timetable.setFileData(trim(request.fileData()));
        timetable.setFileType(trim(request.fileType()));
        timetable.setUploadedAt(resolveDateTime(request.uploadedAt(), timetable.getUploadedAt()));
        timetable.setTemplateDataJson(writeJson(request.templateData()));
        timetable.setTemplateMetaJson(writeJson(request.templateMeta()));
    }

    private ClassTimetableResponse toClassTimetableResponse(ClassTimetable timetable) {
        return new ClassTimetableResponse(
                timetable.getId(),
                timetable.getAcademicSession() == null ? null : timetable.getAcademicSession().getId(),
                timetable.getSchoolClass() == null ? null : timetable.getSchoolClass().getId(),
                timetable.getSection() == null ? null : timetable.getSection().getId(),
                timetable.getSection() == null ? null : timetable.getSection().getName(),
                timetable.getAttendanceTeacher() == null ? null : timetable.getAttendanceTeacher().getId(),
                timetable.getClassName(),
                timetable.getFileName(),
                StringUtils.hasText(timetable.getTemplateDataJson()) ? null : timetable.getFileData(),
                timetable.getFileType(),
                timetable.getUploadedAt(),
                readJsonObject(timetable.getTemplateDataJson()),
                readJsonObject(timetable.getTemplateMetaJson()),
                timetable.getCreatedAt(),
                timetable.getUpdatedAt()
        );
    }

    private TimetableTemplateDraftResponse toTemplateDraftResponse(TimetableTemplateDraft draft) {
        return new TimetableTemplateDraftResponse(
                draft.getId(),
                draft.getAcademicSession() == null ? null : draft.getAcademicSession().getId(),
                draft.getSchoolClass() == null ? null : draft.getSchoolClass().getId(),
                draft.getSection() == null ? null : draft.getSection().getId(),
                draft.getSection() == null ? null : draft.getSection().getName(),
                draft.getClassName(),
                readJsonObject(draft.getDraftDataJson()),
                draft.getCreatedAt(),
                draft.getUpdatedAt()
        );
    }

    private TimetablePeriodResponse toPeriodResponse(TimetablePeriod period) {
        ClassTimetable timetable = period.getTimetable();
        SchoolClass schoolClass = timetable.getSchoolClass();
        ClassSection section = timetable.getSection();
        Teacher teacher = period.getTeacher();
        String teacherName = StringUtils.hasText(teacher.getName())
                ? teacher.getName()
                : ((teacher.getFirstName() == null ? "" : teacher.getFirstName()) + " " + (teacher.getLastName() == null ? "" : teacher.getLastName())).trim();
        return new TimetablePeriodResponse(
                period.getId(),
                toDisplayDay(period.getDayOfWeek()),
                period.getPeriodNumber(),
                period.getStartTime() == null ? null : period.getStartTime().toString(),
                period.getEndTime() == null ? null : period.getEndTime().toString(),
                schoolClass == null ? null : schoolClass.getId(),
                section == null ? null : section.getId(),
                schoolClass == null ? timetable.getClassName() : schoolClass.getName(),
                section == null ? null : section.getName(),
                period.getClassSubject().getId(),
                period.getClassSubject().getSubject().getId(),
                period.getClassSubject().getSubject().getName(),
                teacher.getId(),
                StringUtils.hasText(teacher.getEmployeeId()) ? teacherName + " (" + teacher.getEmployeeId() + ")" : teacherName
        );
    }

    private TimetablePeriodResponse toPeriodResponse(TimetablePeriodProjection period) {
        String teacherName = StringUtils.hasText(period.employeeId())
                ? period.teacherName() + " (" + period.employeeId() + ")"
                : period.teacherName();
        return new TimetablePeriodResponse(
                period.id(),
                toDisplayDay(period.dayOfWeek()),
                period.periodNumber(),
                period.startTime() == null ? null : period.startTime().toString(),
                period.endTime() == null ? null : period.endTime().toString(),
                period.classId(),
                period.sectionId(),
                period.className(),
                period.sectionName(),
                period.classSubjectId(),
                period.subjectId(),
                period.subjectName(),
                period.teacherId(),
                teacherName
        );
    }

    private String toDisplayDay(String dayOfWeek) {
        String value = String.valueOf(dayOfWeek == null ? "" : dayOfWeek).toLowerCase();
        return value.isBlank() ? "" : value.substring(0, 1).toUpperCase() + value.substring(1);
    }

    private LocalDateTime resolveDateTime(String value, LocalDateTime fallback) {
        if (StringUtils.hasText(value)) {
            String trimmedValue = value.trim();
            try {
                return LocalDateTime.parse(trimmedValue);
            } catch (Exception ignored) {
                return OffsetDateTime.parse(trimmedValue).toLocalDateTime();
            }
        }
        return fallback == null ? LocalDateTime.now() : fallback;
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to save timetable JSON data.", exception);
        }
    }

    private Object readJsonObject(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            return objectMapper.readValue(value, new TypeReference<Object>() {
            });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read timetable JSON data.", exception);
        }
    }
}
