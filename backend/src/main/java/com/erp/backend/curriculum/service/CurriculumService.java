package com.erp.backend.curriculum.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.erp.backend.course.dto.CourseBookResponse;
import com.erp.backend.course.entity.CourseBook;
import com.erp.backend.course.repository.CourseBookRepository;
import com.erp.backend.curriculum.dto.AcademicSessionResponse;
import com.erp.backend.curriculum.dto.ClassSubjectBulkPayload;
import com.erp.backend.curriculum.dto.ClassSubjectPayload;
import com.erp.backend.curriculum.dto.ClassSubjectResponse;
import com.erp.backend.curriculum.dto.CopyCurriculumRequest;
import com.erp.backend.curriculum.dto.CourseBookResourcePayload;
import com.erp.backend.curriculum.dto.CurriculumClassSummaryResponse;
import com.erp.backend.curriculum.dto.SubjectResponse;
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
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.settings.repository.CollegeSettingsRepository;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CurriculumService {

    private static final Pattern LEADING_CLASS_NUMBER = Pattern.compile("^(?:class\\s*)?(\\d{1,2})(?:\\b|\\s|/)", Pattern.CASE_INSENSITIVE);

    private final InstituteRepository instituteRepository;
    private final CollegeSettingsRepository collegeSettingsRepository;
    private final StudentRepository studentRepository;
    private final CourseBookRepository courseBookRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final ClassSectionRepository classSectionRepository;
    private final SubjectRepository subjectRepository;
    private final ClassSubjectRepository classSubjectRepository;

    public CurriculumService(
            InstituteRepository instituteRepository,
            CollegeSettingsRepository collegeSettingsRepository,
            StudentRepository studentRepository,
            CourseBookRepository courseBookRepository,
            AcademicSessionRepository academicSessionRepository,
            SchoolClassRepository schoolClassRepository,
            ClassSectionRepository classSectionRepository,
            SubjectRepository subjectRepository,
            ClassSubjectRepository classSubjectRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.collegeSettingsRepository = collegeSettingsRepository;
        this.studentRepository = studentRepository;
        this.courseBookRepository = courseBookRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.classSectionRepository = classSectionRepository;
        this.subjectRepository = subjectRepository;
        this.classSubjectRepository = classSubjectRepository;
    }

    @Transactional
    public List<AcademicSessionResponse> getAcademicSessions(Long instituteId) {
        Institute institute = validateInstitute(instituteId);
        ensureCurrentSession(institute);
        return academicSessionRepository.findAllByInstituteIdOrderByCurrentDescNameDesc(instituteId)
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    @Transactional
    public List<CurriculumClassSummaryResponse> getClassSummaries(Long instituteId, Long academicSessionId) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(institute, academicSessionId);
        materializeLegacyCurriculum(institute, session);
        return classSubjectRepository.findClassSummaries(instituteId, session.getId());
    }

    @Transactional
    public List<ClassSubjectResponse> getClassSubjects(Long instituteId, Long classId, Long academicSessionId) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(institute, academicSessionId);
        validateClass(instituteId, classId);
        materializeLegacyCurriculum(institute, session);
        return classSubjectRepository.findSubjectSummaries(instituteId, session.getId(), classId);
    }

    @Transactional(readOnly = true)
    public List<SubjectResponse> getSubjects(Long instituteId) {
        validateInstitute(instituteId);
        return subjectRepository.findAllByInstituteIdOrderByNameAsc(instituteId).stream().map(this::toSubjectResponse).toList();
    }

    @Transactional
    public ClassSubjectResponse saveClassSubject(Long instituteId, ClassSubjectPayload request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession session = resolveSession(institute, request.academicSessionId());
        SchoolClass schoolClass = validateClass(instituteId, request.classId());
        Subject subject = resolveSubject(institute, request.subjectId(), request.subjectName(), request.subjectCode());
        ClassSubject classSubject = classSubjectRepository
                .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectId(instituteId, session.getId(), schoolClass.getId(), subject.getId())
                .orElseGet(() -> {
                    ClassSubject next = new ClassSubject();
                    next.setInstitute(institute);
                    next.setAcademicSession(session);
                    next.setSchoolClass(schoolClass);
                    next.setSubject(subject);
                    return next;
                });
        applyClassSubjectPayload(classSubject, request);
        ClassSubject saved = classSubjectRepository.save(classSubject);
        return classSubjectRepository.findSubjectSummaries(instituteId, session.getId(), schoolClass.getId())
                .stream()
                .filter(row -> row.classSubjectId().equals(saved.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Class subject not found after save."));
    }

    @Transactional
    public List<ClassSubjectResponse> saveClassSubjectsBulk(Long instituteId, ClassSubjectBulkPayload request) {
        for (ClassSubjectPayload subject : request.subjects()) {
            saveClassSubject(instituteId, new ClassSubjectPayload(
                    request.academicSessionId(),
                    request.classId(),
                    subject.subjectId(),
                    subject.subjectName(),
                    subject.subjectCode(),
                    subject.subjectType(),
                    subject.displayOrder(),
                    subject.status(),
                    subject.notes()
            ));
        }
        return getClassSubjects(instituteId, request.classId(), request.academicSessionId());
    }

    @Transactional
    public void archiveClassSubject(Long instituteId, Long classSubjectId) {
        ClassSubject classSubject = classSubjectRepository.findByInstituteIdAndId(instituteId, classSubjectId)
                .orElseThrow(() -> new ResourceNotFoundException("Class subject not found with id: " + classSubjectId));
        classSubject.setStatus("ARCHIVED");
        classSubjectRepository.save(classSubject);
    }

    @Transactional(readOnly = true)
    public List<CourseBookResponse> getBooks(Long instituteId, Long classSubjectId) {
        validateClassSubject(instituteId, classSubjectId);
        return courseBookRepository.findAllByInstituteIdAndClassSubjectIdOrderByPrimaryBookDescBookTitleAscSubjectNameAsc(instituteId, classSubjectId)
                .stream()
                .map(this::toBookResponse)
                .toList();
    }

    @Transactional
    public CourseBookResponse saveBook(Long instituteId, Long classSubjectId, CourseBookResourcePayload request) {
        ClassSubject classSubject = validateClassSubject(instituteId, classSubjectId);
        String title = cleanRequired(request.bookTitle(), "Book title is required.", "bookTitle");
        String publisher = cleanRequired(request.publisher(), "Publisher is required.", "publisher");
        if (courseBookRepository.existsByInstituteIdAndClassSubjectIdAndBookTitleIgnoreCaseAndPublisherIgnoreCase(instituteId, classSubjectId, title, publisher)) {
            throw new FieldValidationException("This book already exists for the selected subject.", Map.of("bookTitle", "Duplicate book."));
        }
        CourseBook book = new CourseBook();
        book.setInstitute(classSubject.getInstitute());
        book.setClassSubject(classSubject);
        applyBookPayload(book, classSubject, request);
        return toBookResponse(courseBookRepository.save(book));
    }

    @Transactional
    public CourseBookResponse updateBook(Long instituteId, Long classSubjectId, Long bookId, CourseBookResourcePayload request) {
        validateClassSubject(instituteId, classSubjectId);
        CourseBook book = courseBookRepository.findByInstituteIdAndId(instituteId, bookId)
                .filter(row -> row.getClassSubject() != null && row.getClassSubject().getId().equals(classSubjectId))
                .orElseThrow(() -> new ResourceNotFoundException("Course book not found with id: " + bookId));
        applyBookPayload(book, book.getClassSubject(), request);
        return toBookResponse(courseBookRepository.save(book));
    }

    @Transactional
    public void deleteBook(Long instituteId, Long classSubjectId, Long bookId) {
        validateClassSubject(instituteId, classSubjectId);
        CourseBook book = courseBookRepository.findByInstituteIdAndId(instituteId, bookId)
                .filter(row -> row.getClassSubject() != null && row.getClassSubject().getId().equals(classSubjectId))
                .orElseThrow(() -> new ResourceNotFoundException("Course book not found with id: " + bookId));
        courseBookRepository.delete(book);
    }

    @Transactional
    public List<ClassSubjectResponse> copyCurriculum(Long instituteId, CopyCurriculumRequest request) {
        Institute institute = validateInstitute(instituteId);
        AcademicSession source = resolveSession(institute, request.sourceAcademicSessionId());
        AcademicSession target = resolveSession(institute, request.targetAcademicSessionId());
        SchoolClass schoolClass = validateClass(instituteId, request.classId());
        boolean copyBooks = request.copyBooks() == null || request.copyBooks();
        List<ClassSubject> sourceSubjects = classSubjectRepository
                .findAllByInstituteIdAndAcademicSessionIdAndSchoolClassIdOrderByDisplayOrderAscSubject_NameAsc(instituteId, source.getId(), schoolClass.getId());
        for (ClassSubject sourceSubject : sourceSubjects) {
            ClassSubject targetSubject = classSubjectRepository
                    .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectId(instituteId, target.getId(), schoolClass.getId(), sourceSubject.getSubject().getId())
                    .orElseGet(() -> {
                        ClassSubject next = new ClassSubject();
                        next.setInstitute(institute);
                        next.setAcademicSession(target);
                        next.setSchoolClass(schoolClass);
                        next.setSubject(sourceSubject.getSubject());
                        return next;
                    });
            targetSubject.setSubjectType(sourceSubject.getSubjectType());
            targetSubject.setDisplayOrder(sourceSubject.getDisplayOrder());
            targetSubject.setStatus("ACTIVE");
            targetSubject.setNotes(sourceSubject.getNotes());
            ClassSubject savedTarget = classSubjectRepository.save(targetSubject);
            if (copyBooks) {
                for (CourseBook book : courseBookRepository.findAllByInstituteIdAndClassSubjectIdOrderByPrimaryBookDescBookTitleAscSubjectNameAsc(instituteId, sourceSubject.getId())) {
                    if (!courseBookRepository.existsByInstituteIdAndClassSubjectIdAndBookTitleIgnoreCaseAndPublisherIgnoreCase(
                            instituteId,
                            savedTarget.getId(),
                            defaultValue(book.getBookTitle(), book.getSubjectName()),
                            defaultValue(book.getPublisher(), "")
                    )) {
                        CourseBook copy = new CourseBook();
                        copy.setInstitute(institute);
                        copy.setClassSubject(savedTarget);
                        copy.setClassName(schoolClass.getName());
                        copy.setSubjectName(sourceSubject.getSubject().getName());
                        copy.setBookTitle(defaultValue(book.getBookTitle(), book.getSubjectName()));
                        copy.setPublisher(book.getPublisher());
                        copy.setLanguage(book.getLanguage());
                        copy.setAcademicYear(target.getName());
                        copy.setIsbn(book.getIsbn());
                        copy.setEdition(book.getEdition());
                        copy.setPrimaryBook(book.getPrimaryBook() == null || book.getPrimaryBook());
                        copy.setStatus(book.getStatus());
                        copy.setNotes(book.getNotes());
                        courseBookRepository.save(copy);
                    }
                }
            }
        }
        return getClassSubjects(instituteId, schoolClass.getId(), target.getId());
    }

    private void materializeLegacyCurriculum(Institute institute, AcademicSession session) {
        Set<String> classNames = new LinkedHashSet<>();
        courseBookRepository.findDistinctClassNames(institute.getId()).forEach(value -> addClassName(classNames, value));
        studentRepository.findDistinctClassLabels(institute.getId()).forEach(value -> addClassName(classNames, value));
        classNames.forEach(className -> resolveClass(institute, className));
        studentRepository.findDistinctClassLabels(institute.getId()).forEach(value -> resolveLegacySection(institute, value));
        courseBookRepository.findDistinctClassNames(institute.getId()).forEach(value -> resolveLegacySection(institute, value));

        for (CourseBook legacy : courseBookRepository.findLegacyRows(institute.getId())) {
            String className = clean(legacy.getClassName());
            String subjectName = clean(legacy.getSubjectName());
            if (!StringUtils.hasText(className) || !StringUtils.hasText(subjectName)) {
                continue;
            }
            SchoolClass schoolClass = resolveClass(institute, className);
            Subject subject = resolveSubject(institute, null, subjectName, null);
            ClassSubject classSubject = classSubjectRepository
                    .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectId(institute.getId(), session.getId(), schoolClass.getId(), subject.getId())
                    .orElseGet(() -> {
                        ClassSubject next = new ClassSubject();
                        next.setInstitute(institute);
                        next.setAcademicSession(session);
                        next.setSchoolClass(schoolClass);
                        next.setSubject(subject);
                        next.setSubjectType("CORE");
                        next.setDisplayOrder(0);
                        next.setStatus("ACTIVE");
                        next.setNotes(legacy.getNotes());
                        return classSubjectRepository.save(next);
                    });
            legacy.setClassSubject(classSubject);
            legacy.setClassName(schoolClass.getName());
            legacy.setSubjectName(subject.getName());
            legacy.setBookTitle(defaultValue(legacy.getBookTitle(), subject.getName()));
            legacy.setAcademicYear(defaultValue(legacy.getAcademicYear(), session.getName()));
            legacy.setStatus(defaultValue(legacy.getStatus(), "ACTIVE"));
            courseBookRepository.save(legacy);
        }

        mergeSectionScopedLowerClassSubjects(institute, session);
    }

    private void mergeSectionScopedLowerClassSubjects(Institute institute, AcademicSession session) {
        for (ClassSubject classSubject : classSubjectRepository.findAllByInstituteIdAndAcademicSessionId(institute.getId(), session.getId())) {
            String currentClassName = classSubject.getSchoolClass().getName();
            String canonicalClassName = canonicalClassName(currentClassName);
            if (!StringUtils.hasText(canonicalClassName) || canonicalClassName.equals(currentClassName)) {
                continue;
            }

            SchoolClass canonicalClass = resolveClass(institute, canonicalClassName);
            ClassSubject target = classSubjectRepository
                    .findByInstituteIdAndAcademicSessionIdAndSchoolClassIdAndSubjectId(
                            institute.getId(),
                            session.getId(),
                            canonicalClass.getId(),
                            classSubject.getSubject().getId()
                    )
                    .filter(existing -> !existing.getId().equals(classSubject.getId()))
                    .orElse(null);

            if (target == null) {
                classSubject.setSchoolClass(canonicalClass);
                classSubjectRepository.save(classSubject);
                for (CourseBook book : courseBookRepository.findAllByInstituteIdAndClassSubjectIdOrderByPrimaryBookDescBookTitleAscSubjectNameAsc(institute.getId(), classSubject.getId())) {
                    book.setClassName(canonicalClass.getName());
                    courseBookRepository.save(book);
                }
            } else {
                for (CourseBook book : courseBookRepository.findAllByInstituteIdAndClassSubjectIdOrderByPrimaryBookDescBookTitleAscSubjectNameAsc(institute.getId(), classSubject.getId())) {
                    book.setClassSubject(target);
                    book.setClassName(canonicalClass.getName());
                    courseBookRepository.save(book);
                }
                classSubjectRepository.delete(classSubject);
            }
        }

        schoolClassRepository.findAllByInstituteIdOrderByNameAsc(institute.getId()).forEach(schoolClass -> {
            String canonicalClassName = canonicalClassName(schoolClass.getName());
            if (StringUtils.hasText(canonicalClassName) && !canonicalClassName.equals(schoolClass.getName())) {
                schoolClass.setStatus("ARCHIVED");
                schoolClassRepository.save(schoolClass);
            }
        });
    }

    private AcademicSession resolveSession(Institute institute, Long academicSessionId) {
        if (academicSessionId != null) {
            return academicSessionRepository.findByInstituteIdAndId(institute.getId(), academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Academic session not found with id: " + academicSessionId));
        }
        return ensureCurrentSession(institute);
    }

    private AcademicSession ensureCurrentSession(Institute institute) {
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(institute.getId())
                .orElseGet(() -> {
                    String academicYear = collegeSettingsRepository.findByInstituteId(institute.getId())
                            .map(settings -> defaultValue(settings.getAcademicYear(), "2026-2027"))
                            .orElse("2026-2027");
                    return academicSessionRepository.findByInstituteIdAndNameIgnoreCase(institute.getId(), academicYear)
                            .orElseGet(() -> {
                                AcademicSession session = new AcademicSession();
                                session.setInstitute(institute);
                                session.setName(academicYear);
                                session.setStatus("ACTIVE");
                                session.setCurrent(true);
                                return academicSessionRepository.save(session);
                            });
                });
    }

    private SchoolClass validateClass(Long instituteId, Long classId) {
        return schoolClassRepository.findByInstituteIdAndId(instituteId, classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found with id: " + classId));
    }

    private ClassSubject validateClassSubject(Long instituteId, Long classSubjectId) {
        return classSubjectRepository.findByInstituteIdAndId(instituteId, classSubjectId)
                .orElseThrow(() -> new ResourceNotFoundException("Class subject not found with id: " + classSubjectId));
    }

    private SchoolClass resolveClass(Institute institute, String className) {
        String cleanName = canonicalClassName(cleanRequired(className, "Class name is required.", "className"));
        String normalizedName = normalizeKey(cleanName);
        return schoolClassRepository.findByInstituteIdAndNormalizedName(institute.getId(), normalizedName)
                .orElseGet(() -> {
                    SchoolClass schoolClass = new SchoolClass();
                    schoolClass.setInstitute(institute);
                    schoolClass.setName(cleanName);
                    schoolClass.setNormalizedName(normalizedName);
                    schoolClass.setStatus("ACTIVE");
                    return schoolClassRepository.save(schoolClass);
                });
    }

    private void resolveLegacySection(Institute institute, String classLabel) {
        String cleanLabel = clean(classLabel);
        if (!StringUtils.hasText(cleanLabel) || !cleanLabel.contains("/")) {
            return;
        }
        String[] parts = cleanLabel.split("/", 2);
        String className = canonicalClassName(parts[0]);
        String sectionName = clean(parts[1]);
        if (!StringUtils.hasText(className) || !StringUtils.hasText(sectionName)) {
            return;
        }
        SchoolClass schoolClass = resolveClass(institute, className);
        String normalizedSection = normalizeKey(sectionName);
        classSectionRepository.findByInstituteIdAndSchoolClassIdAndNormalizedName(institute.getId(), schoolClass.getId(), normalizedSection)
                .orElseGet(() -> {
                    ClassSection section = new ClassSection();
                    section.setInstitute(institute);
                    section.setSchoolClass(schoolClass);
                    section.setName(sectionName);
                    section.setNormalizedName(normalizedSection);
                    section.setStatus("ACTIVE");
                    return classSectionRepository.save(section);
                });
    }

    private Subject resolveSubject(Institute institute, Long subjectId, String subjectName, String subjectCode) {
        if (subjectId != null) {
            return subjectRepository.findByInstituteIdAndId(institute.getId(), subjectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Subject not found with id: " + subjectId));
        }
        String cleanName = cleanRequired(subjectName, "Subject name is required.", "subjectName");
        String normalizedName = normalizeKey(cleanName);
        return subjectRepository.findByInstituteIdAndNormalizedName(institute.getId(), normalizedName)
                .orElseGet(() -> {
                    Subject subject = new Subject();
                    subject.setInstitute(institute);
                    subject.setName(cleanName);
                    subject.setNormalizedName(normalizedName);
                    subject.setCode(resolveSubjectCode(institute.getId(), subjectName, subjectCode));
                    subject.setStatus("ACTIVE");
                    return subjectRepository.save(subject);
                });
    }

    private String resolveSubjectCode(Long instituteId, String subjectName, String subjectCode) {
        String base = StringUtils.hasText(subjectCode) ? subjectCode.trim().toUpperCase(Locale.ROOT) : buildSubjectCode(subjectName);
        String candidate = base;
        int suffix = 2;
        while (subjectRepository.findByInstituteIdAndCodeIgnoreCase(instituteId, candidate).isPresent()) {
            candidate = base + suffix;
            suffix++;
        }
        return candidate;
    }

    private void applyClassSubjectPayload(ClassSubject classSubject, ClassSubjectPayload request) {
        classSubject.setSubjectType(defaultValue(request.subjectType(), "CORE").toUpperCase(Locale.ROOT));
        classSubject.setDisplayOrder(request.displayOrder() == null ? 0 : request.displayOrder());
        classSubject.setStatus(defaultValue(request.status(), "ACTIVE").toUpperCase(Locale.ROOT));
        classSubject.setNotes(clean(request.notes()));
    }

    private void applyBookPayload(CourseBook book, ClassSubject classSubject, CourseBookResourcePayload request) {
        String title = cleanRequired(request.bookTitle(), "Book title is required.", "bookTitle");
        book.setClassSubject(classSubject);
        book.setClassName(classSubject.getSchoolClass().getName());
        book.setSubjectName(classSubject.getSubject().getName());
        book.setBookTitle(title);
        book.setPublisher(cleanRequired(request.publisher(), "Publisher is required.", "publisher"));
        book.setLanguage(defaultValue(request.language(), "English"));
        book.setAcademicYear(classSubject.getAcademicSession().getName());
        book.setIsbn(clean(request.isbn()));
        book.setEdition(clean(request.edition()));
        book.setPrimaryBook(request.primaryBook() == null || request.primaryBook());
        book.setStatus(defaultValue(request.status(), "ACTIVE").toUpperCase(Locale.ROOT));
        book.setNotes(clean(request.notes()));
    }

    private CourseBookResponse toBookResponse(CourseBook book) {
        ClassSubject classSubject = book.getClassSubject();
        return new CourseBookResponse(
                book.getId(),
                classSubject == null ? null : classSubject.getId(),
                classSubject == null ? null : classSubject.getSubject().getId(),
                classSubject == null ? null : classSubject.getSchoolClass().getId(),
                classSubject == null ? book.getClassName() : classSubject.getSchoolClass().getName(),
                classSubject == null ? book.getSubjectName() : classSubject.getSubject().getName(),
                classSubject == null ? null : classSubject.getSubject().getCode(),
                defaultValue(book.getBookTitle(), book.getSubjectName()),
                book.getPublisher(),
                defaultValue(book.getLanguage(), "English"),
                classSubject == null ? book.getAcademicYear() : classSubject.getAcademicSession().getName(),
                book.getIsbn(),
                book.getEdition(),
                book.getPrimaryBook() == null || book.getPrimaryBook(),
                defaultValue(book.getStatus(), "ACTIVE"),
                book.getNotes(),
                book.getCreatedAt(),
                book.getUpdatedAt()
        );
    }

    private AcademicSessionResponse toSessionResponse(AcademicSession session) {
        return new AcademicSessionResponse(
                session.getId(),
                session.getName(),
                session.getStatus(),
                session.isCurrent(),
                session.getStartDate(),
                session.getEndDate()
        );
    }

    private SubjectResponse toSubjectResponse(Subject subject) {
        return new SubjectResponse(subject.getId(), subject.getName(), subject.getCode(), subject.getStatus(), subject.getDescription());
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void addClassName(Set<String> classNames, String value) {
        String cleanName = canonicalClassName(clean(value));
        if (!StringUtils.hasText(cleanName) || "Unassigned".equalsIgnoreCase(cleanName)) {
            return;
        }
        classNames.add(cleanName);
    }

    private String canonicalClassName(String value) {
        String cleanName = clean(value);
        if (!StringUtils.hasText(cleanName)) {
            return cleanName;
        }
        Integer classNumber = extractLeadingClassNumber(cleanName);
        if (classNumber != null && classNumber >= 1 && classNumber <= 8) {
            return cleanName.split("/", 2)[0].trim();
        }
        return cleanName;
    }

    private Integer extractLeadingClassNumber(String value) {
        Matcher matcher = LEADING_CLASS_NUMBER.matcher(String.valueOf(value == null ? "" : value).trim());
        if (!matcher.find()) {
            return null;
        }
        return Integer.parseInt(matcher.group(1));
    }

    private String buildSubjectCode(String subjectName) {
        String compact = String.valueOf(subjectName).replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (compact.length() >= 4) {
            return compact.substring(0, 4);
        }
        return String.format("%-4s", compact).replace(' ', 'X');
    }

    private String cleanRequired(String value, String message, String field) {
        String clean = clean(value);
        if (!StringUtils.hasText(clean)) {
            throw new FieldValidationException(message, Map.of(field, message));
        }
        return clean;
    }

    private String clean(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeKey(String value) {
        return clean(value).toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
