package com.erp.backend.student.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

import com.erp.backend.auth.AuthService;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.service.FeeService;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.dto.StudentClassSummaryResponse;
import com.erp.backend.student.dto.StudentDocumentPayload;
import com.erp.backend.student.dto.StudentListResponse;
import com.erp.backend.student.dto.StudentPageResponse;
import com.erp.backend.student.dto.StudentPayload;
import com.erp.backend.student.dto.StudentPortalLoginRequest;
import com.erp.backend.student.dto.StudentPortalLoginResponse;
import com.erp.backend.student.dto.StudentResponse;
import com.erp.backend.student.dto.UpdateStudentFacilitiesRequest;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class StudentService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^A-Z0-9]");
    private static final Pattern TEN_DIGITS = Pattern.compile("\\d{10}");
    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "createdAt",
            "firstName",
            "lastName",
            "name",
            "rollNo",
            "enrollmentNo",
            "admissionDate"
    );

    private final StudentRepository studentRepository;
    private final InstituteRepository instituteRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final ObjectMapper objectMapper;
    private final AuthService authService;
    private final FeeService feeService;

    public StudentService(
            StudentRepository studentRepository,
            InstituteRepository instituteRepository,
            SchoolClassRepository schoolClassRepository,
            ObjectMapper objectMapper,
            AuthService authService,
            FeeService feeService
    ) {
        this.studentRepository = studentRepository;
        this.instituteRepository = instituteRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.objectMapper = objectMapper;
        this.authService = authService;
        this.feeService = feeService;
    }

    public List<StudentResponse> getAllStudents(Long instituteId) {
        validateInstitute(instituteId);
        return studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<StudentClassSummaryResponse> getClassSummary(Long instituteId) {
        validateInstitute(instituteId);
        return studentRepository.findClassSummaries(instituteId);
    }

    public StudentPageResponse<StudentListResponse> getStudentsPage(
            Long instituteId,
            Integer page,
            Integer size,
            String assignedClass,
            String search,
            String status,
            String sort
    ) {
        validateInstitute(instituteId);
        Pageable pageable = PageRequest.of(
                Math.max(page == null ? 0 : page, 0),
                normalizePageSize(size),
                parseSort(sort)
        );
        Page<StudentListResponse> students = studentRepository.findStudentList(
                instituteId,
                blankToEmpty(assignedClass),
                blankToEmpty(search),
                blankToEmpty(status),
                pageable
        );

        return new StudentPageResponse<>(
                students.getContent(),
                students.getNumber(),
                students.getSize(),
                students.getTotalElements(),
                students.getTotalPages()
        );
    }

    public StudentResponse getStudentById(Long instituteId, Long studentId) {
        return toResponse(findStudent(instituteId, studentId));
    }

    public StudentPortalLoginResponse loginStudent(StudentPortalLoginRequest request) {
        throw new IllegalArgumentException("Student portal login has moved to the main login. Use your enrollment ID and password.");
    }

    public synchronized StudentResponse createStudent(Long instituteId, StudentPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateRequiredFields(request);
        validateUniqueness(instituteId, request);
        validatePhoto(request);
        validatePhoneNumbers(request);

        Student student = new Student();
        student.setInstitute(institute);
        applyStudentPayload(instituteId, student, request);
        student.setRollNo(resolveNextRollNo(instituteId, student.getAssignedClass()));
        student.setQrCodeData(buildFinalQrCodeData(student));
        Student savedStudent = studentRepository.save(student);
        authService.upsertStudentAccount(savedStudent, buildInitialPortalPassword(savedStudent), false);
        feeService.synchronizeChargesForStudent(instituteId, savedStudent.getId());
        return toResponse(savedStudent);
    }

    public StudentResponse updateStudent(Long instituteId, Long studentId, StudentPayload request) {
        Student student = findStudent(instituteId, studentId);
        validateRequiredFields(request);
        validateUniquenessForUpdate(instituteId, student, request);
        validatePhoto(request);
        validatePhoneNumbers(request);

        String previousAssignedClass = student.getAssignedClass();
        applyStudentPayload(instituteId, student, request);
        if (!Objects.equals(normalizeComparable(previousAssignedClass), normalizeComparable(student.getAssignedClass()))
                || !StringUtils.hasText(student.getRollNo())) {
            student.setRollNo(resolveNextRollNo(instituteId, student.getAssignedClass()));
        }
        student.setQrCodeData(buildFinalQrCodeData(student));
        Student savedStudent = studentRepository.save(student);
        authService.upsertStudentAccount(savedStudent, null, false);
        if (!Objects.equals(normalizeComparable(previousAssignedClass), normalizeComparable(savedStudent.getAssignedClass()))) {
            feeService.synchronizeChargesForStudent(instituteId, savedStudent.getId());
        }
        return toResponse(savedStudent);
    }

    public List<StudentResponse> importStudents(Long instituteId, List<StudentPayload> students) {
        Institute institute = validateInstitute(instituteId);
        Map<String, Integer> nextRollByClass = new LinkedHashMap<>();
        List<Student> entities = students.stream()
                .map(payload -> {
                    validateRequiredFields(payload);
                    validatePhoneNumbers(payload);
                    Student student = new Student();
                    student.setInstitute(institute);
                    applyStudentPayload(instituteId, student, payload);
                    if (StringUtils.hasText(student.getAssignedClass())) {
                        int nextRoll = nextRollByClass.computeIfAbsent(
                                student.getAssignedClass(),
                                className -> maxRollNo(instituteId, className)
                        ) + 1;
                        nextRollByClass.put(student.getAssignedClass(), nextRoll);
                        student.setRollNo(String.format("%03d", nextRoll));
                        student.setQrCodeData(buildFinalQrCodeData(student));
                    }
                    return student;
                })
                .toList();

        List<Student> savedStudents = studentRepository.saveAll(entities);
        savedStudents.forEach(student -> authService.upsertStudentAccount(student, buildInitialPortalPassword(student), false));
        feeService.synchronizeChargesForStudents(instituteId, savedStudents.stream().map(Student::getId).toList());

        return studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public StudentResponse updateFacilities(Long instituteId, Long studentId, UpdateStudentFacilitiesRequest request) {
        Student student = findStudent(instituteId, studentId);

        if (StringUtils.hasText(request.transportOptIn())) {
            student.setTransportOptIn(request.transportOptIn());
        }
        if (StringUtils.hasText(request.hostelOptIn())) {
            student.setHostelOptIn(request.hostelOptIn());
        }
        if (StringUtils.hasText(request.libraryOptIn())) {
            student.setLibraryOptIn(request.libraryOptIn());
        }
        if (StringUtils.hasText(request.transportStatus())) {
            student.setTransportStatus(request.transportStatus());
        }
        if (StringUtils.hasText(request.hostelStatus())) {
            student.setHostelStatus(request.hostelStatus());
        }
        if (StringUtils.hasText(request.libraryStatus())) {
            student.setLibraryStatus(request.libraryStatus());
        }
        if (request.libraryMonthlyCharge() != null) {
            student.setLibraryMonthlyCharge(trim(request.libraryMonthlyCharge()));
        }

        Student savedStudent = studentRepository.save(student);
        feeService.synchronizeChargesForStudent(instituteId, savedStudent.getId());
        return toResponse(savedStudent);
    }

    public void deleteStudent(Long instituteId, Long studentId) {
        Student student = findStudent(instituteId, studentId);
        studentRepository.delete(student);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private void validateUniqueness(Long instituteId, StudentPayload request) {
        if (StringUtils.hasText(request.email())
                && studentRepository.existsByInstituteIdAndEmailIgnoreCase(instituteId, request.email().trim())) {
            throw new IllegalArgumentException("Student already exists with email: " + request.email());
        }
        String enrollmentNo = sanitizeEnrollmentNo(request.enrollmentNo());
        if (StringUtils.hasText(enrollmentNo)
                && studentRepository.existsByInstituteIdAndEnrollmentNoIgnoreCase(instituteId, enrollmentNo)) {
            throw new IllegalArgumentException("Student already exists with enrollment number: " + enrollmentNo);
        }
    }

    private void validateUniquenessForUpdate(Long instituteId, Student existingStudent, StudentPayload request) {
        String nextEmail = normalizeEmail(request.email());
        if (StringUtils.hasText(nextEmail)
                && studentRepository.existsByInstituteIdAndEmailIgnoreCaseAndIdNot(instituteId, nextEmail, existingStudent.getId())) {
            throw new IllegalArgumentException("Student already exists with email: " + nextEmail);
        }

        String nextEnrollment = sanitizeEnrollmentNo(request.enrollmentNo());
        if (StringUtils.hasText(nextEnrollment)
                && studentRepository.existsByInstituteIdAndEnrollmentNoIgnoreCaseAndIdNot(instituteId, nextEnrollment, existingStudent.getId())) {
            throw new IllegalArgumentException("Student already exists with enrollment number: " + nextEnrollment);
        }
    }

    private void applyStudentPayload(Long instituteId, Student student, StudentPayload request) {
        student.setFirstName(uppercase(request.firstName()));
        student.setLastName(uppercase(request.lastName()));
        student.setName(buildStudentName(uppercase(request.firstName()), uppercase(request.lastName())));
        student.setDob(trim(request.dob()));
        student.setGender(trim(request.gender()));
        student.setEmail(normalizeEmail(request.email()));
        student.setMobile(digitsOnlyOrNull(request.mobile()));
        student.setBloodGroup(uppercase(request.bloodGroup()));
        student.setAddress(uppercase(request.address()));
        student.setCity(uppercase(request.city()));
        student.setPincode(digitsOnlyOrNull(request.pincode()));
        student.setState(uppercase(request.state()));
        student.setGuardianName(uppercase(resolveParentName(request.guardianFirstName(), request.guardianLastName(), request.guardianName())));
        student.setMotherName(uppercase(resolveParentName(request.motherFirstName(), request.motherLastName(), request.motherName())));
        student.setGuardianPhone(digitsOnlyOrNull(request.guardianPhone()));
        student.setPrevSchool(uppercase(request.prevSchool()));
        student.setCategory(uppercase(request.category()));
        String today = LocalDate.now().toString();
        student.setRegDate(resolveDate(request.regDate(), today));
        student.setAdmissionDate(resolveDate(request.admissionDate(), today));
        student.setAcademicYear(defaultValue(request.academicYear(), buildAcademicYear(student.getAdmissionDate())));
        student.setEnrollmentNo(resolveEnrollmentNo(student, request));
        SchoolClass schoolClass = resolveSchoolClass(instituteId, request);
        student.setSchoolClass(schoolClass);
        student.setClassName(schoolClass == null ? uppercase(request.className()) : schoolClass.getName());
        student.setSection(uppercase(request.section()));
        student.setAssignedClass(resolveAssignedClass(request));
        student.setAdmissionCategory(uppercase(request.admissionCategory()));
        student.setTransportOptIn(defaultValue(request.transportOptIn(), "no"));
        student.setHostelOptIn(defaultValue(request.hostelOptIn(), "no"));
        student.setLibraryOptIn(defaultValue(request.libraryOptIn(), "no"));
        student.setTransportStatus(resolveFacilityStatus(request.transportOptIn(), request.transportStatus()));
        student.setHostelStatus(resolveFacilityStatus(request.hostelOptIn(), request.hostelStatus()));
        student.setLibraryStatus(resolveFacilityStatus(request.libraryOptIn(), request.libraryStatus()));
        student.setLibraryMonthlyCharge(null);
        student.setDocumentType(uppercase(request.documentType()));
        student.setOtherDocumentName(uppercase(request.otherDocumentName()));
        student.setFileUploadPath(trim(request.fileUploadPath()));
        student.setDocumentsJson(writeDocuments(normalizeDocuments(request.documents())));
        student.setCardExpiryDate(trim(request.cardExpiryDate()));
        student.setPhotoUrl(trim(request.photoUrl()));
        student.setQrCodeData(resolveQrCodeData(student, request));
        student.setStatus(defaultValue(request.status(), "Verified"));
    }

    private StudentResponse toResponse(Student student) {
        String transportOptIn = defaultValue(student.getTransportOptIn(), "no");
        String hostelOptIn = defaultValue(student.getHostelOptIn(), "no");
        String libraryOptIn = defaultValue(student.getLibraryOptIn(), "no");
        String transportStatus = defaultValue(student.getTransportStatus(), "inactive");
        String hostelStatus = defaultValue(student.getHostelStatus(), "inactive");
        String libraryStatus = defaultValue(student.getLibraryStatus(), "inactive");

        Map<String, Object> facilities = Map.of(
                "transport", Map.of(
                        "requested", "yes".equalsIgnoreCase(transportOptIn) || "true".equalsIgnoreCase(transportOptIn),
                        "active", "active".equalsIgnoreCase(transportStatus),
                        "status", transportStatus
                ),
                "hostel", Map.of(
                        "requested", "yes".equalsIgnoreCase(hostelOptIn) || "true".equalsIgnoreCase(hostelOptIn),
                        "active", "active".equalsIgnoreCase(hostelStatus),
                        "status", hostelStatus
                ),
                "library", Map.of(
                        "requested", "yes".equalsIgnoreCase(libraryOptIn) || "true".equalsIgnoreCase(libraryOptIn),
                        "active", "active".equalsIgnoreCase(libraryStatus),
                        "status", libraryStatus,
                        "monthlyCharge", defaultValue(student.getLibraryMonthlyCharge(), "0")
                )
        );

        return new StudentResponse(
                student.getId(),
                student.getFirstName(),
                student.getLastName(),
                student.getDob(),
                student.getGender(),
                student.getEmail(),
                student.getMobile(),
                student.getRegDate(),
                student.getBloodGroup(),
                student.getAddress(),
                student.getCity(),
                student.getPincode(),
                student.getState(),
                student.getGuardianName(),
                student.getMotherName(),
                student.getGuardianPhone(),
                student.getPrevSchool(),
                student.getCategory(),
                student.getAdmissionDate(),
                student.getAcademicYear(),
                student.getEnrollmentNo(),
                student.getRollNo(),
                student.getSchoolClass() == null ? null : student.getSchoolClass().getId(),
                student.getClassName(),
                student.getSection(),
                student.getAssignedClass(),
                student.getAdmissionCategory(),
                transportOptIn,
                hostelOptIn,
                libraryOptIn,
                transportStatus,
                hostelStatus,
                libraryStatus,
                student.getLibraryMonthlyCharge(),
                facilities,
                student.getDocumentType(),
                student.getOtherDocumentName(),
                student.getFileUploadPath(),
                readDocuments(student.getDocumentsJson()),
                student.getQrCodeData(),
                student.getCardExpiryDate(),
                student.getPhotoUrl(),
                defaultValue(student.getStatus(), "Verified"),
                student.getCreatedAt(),
                student.getUpdatedAt()
        );
    }

    private List<StudentDocumentPayload> readDocuments(String documentsJson) {
        if (!StringUtils.hasText(documentsJson)) {
            return List.of();
        }

        try {
            return objectMapper.readValue(documentsJson, new TypeReference<List<StudentDocumentPayload>>() {
            });
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read student documents.", exception);
        }
    }

    private String writeDocuments(List<StudentDocumentPayload> documents) {
        try {
            return objectMapper.writeValueAsString(documents == null ? List.of() : documents);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to save student documents.", exception);
        }
    }

    private List<StudentDocumentPayload> normalizeDocuments(List<StudentDocumentPayload> documents) {
        if (documents == null) {
            return List.of();
        }

        return documents.stream()
                .filter(Objects::nonNull)
                .map(document -> new StudentDocumentPayload(
                        document.id(),
                        trim(document.documentType()),
                        trim(firstNonBlank(document.fileUploadPath(), document.fileName())),
                        trim(document.fileName()),
                        trim(document.fileType()),
                        trim(document.fileData()),
                        document.fileSize()
                ))
                .toList();
    }

    private String normalizeEmail(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase() : null;
    }

    private String buildAcademicYear(String dateValue) {
        LocalDate date = StringUtils.hasText(dateValue) ? LocalDate.parse(dateValue) : LocalDate.now();
        int startYear = date.getMonthValue() >= 4 ? date.getYear() : date.getYear() - 1;
        return startYear + "-" + (startYear + 1);
    }

    private void validatePhoto(StudentPayload request) {
        if (!StringUtils.hasText(request.photoUrl())) {
            throw new IllegalArgumentException("Student photo upload is required.");
        }
    }

    private SchoolClass resolveSchoolClass(Long instituteId, StudentPayload request) {
        if (request.classId() != null) {
            SchoolClass schoolClass = schoolClassRepository.findByInstituteIdAndId(instituteId, request.classId())
                    .orElseThrow(() -> new IllegalArgumentException("INVALID_STUDENT_CLASS"));
            if ("ARCHIVED".equalsIgnoreCase(schoolClass.getStatus())) {
                throw new IllegalArgumentException("ARCHIVED_STUDENT_CLASS_NOT_ALLOWED");
            }
            return schoolClass;
        }
        if (!StringUtils.hasText(request.className())) {
            return null;
        }
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeClassName(request.className()))
                .filter(schoolClass -> !"ARCHIVED".equalsIgnoreCase(schoolClass.getStatus()))
                .orElse(null);
    }

    private void validateRequiredFields(StudentPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        requireText(errors, "firstName", request.firstName(), "First name is required.");
        requireText(errors, "dob", request.dob(), "Date of birth is required.");
        requireText(errors, "mobile", request.mobile(), "Student mobile number is required.");
        requireText(errors, "guardianFirstName", request.guardianFirstName(), "Father first name is required.");
        requireText(errors, "motherFirstName", request.motherFirstName(), "Mother first name is required.");
        requireText(errors, "guardianPhone", request.guardianPhone(), "Father mobile number is required.");
        requireText(errors, "category", request.category(), "Category is required.");
        requireText(errors, "address", request.address(), "Permanent address is required.");
        requireText(errors, "city", request.city(), "City is required.");
        requireText(errors, "pincode", request.pincode(), "Pincode is required.");
        requireText(errors, "state", request.state(), "State is required.");
        requireText(errors, "className", request.className(), "Class is required.");
        requireText(errors, "section", request.section(), "Section is required.");
        requireText(errors, "admissionCategory", request.admissionCategory(), "Admission category is required.");
        requireText(errors, "transportOptIn", request.transportOptIn(), "Select transport facility option.");
        requireText(errors, "hostelOptIn", request.hostelOptIn(), "Select hostel facility option.");
        requireText(errors, "libraryOptIn", request.libraryOptIn(), "Select library facility option.");

        if (!errors.isEmpty()) {
            throw new FieldValidationException("Please fix the highlighted fields.", errors);
        }
    }

    private void requireText(Map<String, String> errors, String field, String value, String message) {
        if (!StringUtils.hasText(value)) {
            errors.put(field, message);
        }
    }

    private String resolveDate(String requestedDate, String fallback) {
        return StringUtils.hasText(requestedDate) ? requestedDate.trim() : fallback;
    }

    private String resolveEnrollmentNo(Student student, StudentPayload request) {
        String requestedEnrollmentNo = sanitizeEnrollmentNo(request.enrollmentNo());
        if (StringUtils.hasText(requestedEnrollmentNo)) {
            return requestedEnrollmentNo;
        }

        if (StringUtils.hasText(student.getEnrollmentNo()) && student.getEnrollmentNo().trim().toUpperCase().contains("STU")) {
            return sanitizeEnrollmentNo(student.getEnrollmentNo());
        }

        String instituteCode = buildInstituteCode(student.getInstitute().getInstituteName());
        long nextSequence = studentRepository.countByInstituteId(student.getInstitute().getId()) + 1;
        String enrollmentNo = formatEnrollmentNo(instituteCode, nextSequence);
        while (studentRepository.existsByInstituteIdAndEnrollmentNoIgnoreCase(student.getInstitute().getId(), enrollmentNo)) {
            nextSequence++;
            enrollmentNo = formatEnrollmentNo(instituteCode, nextSequence);
        }
        return enrollmentNo;
    }

    private String resolveParentName(String firstName, String lastName, String fallbackName) {
        String combinedName = buildStudentName(uppercase(firstName), uppercase(lastName));
        return StringUtils.hasText(combinedName) ? combinedName : fallbackName;
    }

    private String resolveAssignedClass(StudentPayload request) {
        if (StringUtils.hasText(request.className()) && StringUtils.hasText(request.section())) {
            return request.className().trim().toUpperCase() + " / " + request.section().trim().toUpperCase();
        }
        if (StringUtils.hasText(request.className())) {
            return request.className().trim().toUpperCase();
        }
        if (StringUtils.hasText(request.assignedClass())) {
            return request.assignedClass().trim().toUpperCase();
        }
        return null;
    }

    private String normalizeClassName(String value) {
        return StringUtils.hasText(value) ? value.trim().replaceAll("\\s+", " ").toLowerCase() : "";
    }

    private String resolveFacilityStatus(String optIn, String requestedStatus) {
        if (!"yes".equalsIgnoreCase(optIn)) {
            return "inactive";
        }
        return defaultValue(requestedStatus, "active").toLowerCase();
    }

    private String resolveQrCodeData(Student student, StudentPayload request) {
        if (StringUtils.hasText(student.getQrCodeData()) && StringUtils.hasText(request.qrCodeData())) {
            return request.qrCodeData().trim();
        }

        return buildFinalQrCodeData(student, normalizeDocuments(request.documents()));
    }

    private String buildFinalQrCodeData(Student student) {
        return buildFinalQrCodeData(student, readDocuments(student.getDocumentsJson()));
    }

    private String buildFinalQrCodeData(Student student, List<StudentDocumentPayload> documents) {
        String documentSummary = normalizeDocuments(documents).stream()
                .map(document -> firstNonBlank(document.documentType(), firstNonBlank(document.fileName(), document.fileUploadPath())))
                .filter(StringUtils::hasText)
                .toList()
                .stream()
                .reduce((first, second) -> first + ", " + second)
                .orElse("N/A");

        return String.join("\n",
                "ERP STUDENT PROFILE",
                "Name: " + defaultValue(buildStudentName(student.getFirstName(), student.getLastName()), "Student"),
                "Enrollment No: " + defaultValue(student.getEnrollmentNo(), "N/A"),
                "Class: " + defaultValue(firstNonBlank(student.getAssignedClass(), student.getClassName()), "N/A"),
                "Section: " + defaultValue(student.getSection(), "N/A"),
                "DOB: " + defaultValue(student.getDob(), "N/A"),
                "Gender: " + defaultValue(student.getGender(), "N/A"),
                "Mobile: " + defaultValue(student.getMobile(), "N/A"),
                "Email: " + defaultValue(student.getEmail(), "N/A"),
                "Father: " + defaultValue(student.getGuardianName(), "N/A"),
                "Father Phone: " + defaultValue(student.getGuardianPhone(), "N/A"),
                "Blood Group: " + defaultValue(student.getBloodGroup(), "N/A"),
                "Admission Date: " + defaultValue(student.getAdmissionDate(), "N/A"),
                "Documents: " + documentSummary);
    }

    private String buildInitialPortalPassword(Student student) {
        return firstSixDigits(student.getMobile(), "Student mobile number") + birthYear(student.getDob(), "Student date of birth");
    }

    private String firstSixDigits(String value, String label) {
        String digits = digitsOnly(value);
        if (digits.length() < 6) {
            throw new IllegalArgumentException(label + " must have at least 6 digits to generate portal password.");
        }
        return digits.substring(0, 6);
    }

    private String birthYear(String value, String label) {
        String trimmed = trim(value);
        if (trimmed == null || trimmed.length() < 4 || !trimmed.substring(0, 4).matches("\\d{4}")) {
            throw new IllegalArgumentException(label + " must start with a 4 digit year to generate portal password.");
        }
        return trimmed.substring(0, 4);
    }

    private String digitsOnly(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.replaceAll("\\D", "");
    }

    private String sanitizeEnrollmentNo(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return NON_ALPHANUMERIC.matcher(value.trim().toUpperCase()).replaceAll("");
    }

    private String formatEnrollmentNo(String instituteCode, long sequence) {
        return instituteCode + "STU" + String.format("%04d", sequence);
    }

    private String buildInstituteCode(String instituteName) {
        if (!StringUtils.hasText(instituteName)) {
            return "INST";
        }

        String compact = NON_ALPHANUMERIC.matcher(instituteName.toUpperCase()).replaceAll("");
        if (compact.isEmpty()) {
            return "INST";
        }

        return compact;
    }

    private String resolveNextRollNo(Long instituteId, String assignedClass) {
        if (!StringUtils.hasText(assignedClass)) {
            return null;
        }

        List<Student> classStudents = studentRepository
                .findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByCreatedAtAsc(instituteId, assignedClass);

        int maxRoll = maxRollNo(classStudents);

        return String.format("%03d", maxRoll + 1);
    }

    private int maxRollNo(Long instituteId, String assignedClass) {
        return maxRollNo(studentRepository.findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByCreatedAtAsc(instituteId, assignedClass));
    }

    private int maxRollNo(List<Student> classStudents) {
        return classStudents.stream()
                .map(Student::getRollNo)
                .map(this::parseRollNo)
                .max(Comparator.naturalOrder())
                .orElse(0);
    }

    private int parseRollNo(String rollNo) {
        if (!StringUtils.hasText(rollNo)) {
            return 0;
        }
        try {
            return Integer.parseInt(rollNo.trim());
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private int normalizePageSize(Integer size) {
        if (size == null || size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    private Sort parseSort(String requestedSort) {
        String value = StringUtils.hasText(requestedSort) ? requestedSort.trim() : "createdAt,desc";
        String[] parts = value.split(",");
        String field = parts.length > 0 && ALLOWED_SORT_FIELDS.contains(parts[0]) ? parts[0] : "createdAt";
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1])
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        return Sort.by(direction, field);
    }

    private String normalizeComparable(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase() : "";
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String blankToEmpty(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }

    private String uppercase(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase() : null;
    }

    private String digitsOnlyOrNull(String value) {
        String digits = digitsOnly(value);
        return StringUtils.hasText(digits) ? digits : null;
    }

    private void validatePhoneNumbers(StudentPayload request) {
        validateOptionalPhone(request.mobile(), "Student mobile number must be exactly 10 digits.");
        validateOptionalPhone(request.guardianPhone(), "Father mobile number must be exactly 10 digits.");
        validateOptionalPincode(request.pincode());
    }

    private void validateOptionalPhone(String value, String message) {
        if (StringUtils.hasText(value) && !TEN_DIGITS.matcher(digitsOnly(value)).matches()) {
            throw new IllegalArgumentException(message);
        }
    }

    private void validateOptionalPincode(String value) {
        if (StringUtils.hasText(value) && !Pattern.matches("\\d{6}", digitsOnly(value))) {
            throw new IllegalArgumentException("Pincode must be exactly 6 digits.");
        }
    }

    private String firstNonBlank(String primary, String fallback) {
        if (StringUtils.hasText(primary)) {
            return primary;
        }
        return StringUtils.hasText(fallback) ? fallback : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String buildStudentName(String firstName, String lastName) {
        String resolvedFirstName = trim(firstName);
        String resolvedLastName = trim(lastName);
        String fullName = String.join(" ",
                resolvedFirstName == null ? "" : resolvedFirstName,
                resolvedLastName == null ? "" : resolvedLastName).trim();
        return StringUtils.hasText(fullName) ? fullName : "Student";
    }
}
