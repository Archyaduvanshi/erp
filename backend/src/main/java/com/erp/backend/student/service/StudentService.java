package com.erp.backend.student.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.dto.StudentDocumentPayload;
import com.erp.backend.student.dto.StudentPayload;
import com.erp.backend.student.dto.StudentPortalLoginRequest;
import com.erp.backend.student.dto.StudentPortalLoginResponse;
import com.erp.backend.student.dto.StudentResponse;
import com.erp.backend.student.dto.UpdateStudentFacilitiesRequest;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class StudentService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^A-Z0-9]");
    private static final Pattern TEN_DIGITS = Pattern.compile("\\d{10}");

    private final StudentRepository studentRepository;
    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    public StudentService(
            StudentRepository studentRepository,
            InstituteRepository instituteRepository,
            ObjectMapper objectMapper
    ) {
        this.studentRepository = studentRepository;
        this.instituteRepository = instituteRepository;
        this.objectMapper = objectMapper;
    }

    public List<StudentResponse> getAllStudents(Long instituteId) {
        validateInstitute(instituteId);
        return studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public StudentResponse getStudentById(Long instituteId, Long studentId) {
        return toResponse(findStudent(instituteId, studentId));
    }

    public StudentPortalLoginResponse loginStudent(StudentPortalLoginRequest request) {
        String identifier = request.identifier().trim();
        String password = request.password().trim();

        Student student = studentRepository
                .findAllBySystemIdIgnoreCaseOrEnrollmentNoIgnoreCaseOrMobile(identifier, identifier, identifier)
                .stream()
                .filter(candidate -> password.equals(resolvePortalPassword(candidate, candidate.getStudentPortalPassword(), candidate.getGuardianPhone(), candidate.getDob())))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Invalid student ID, enrollment number, or phone number, or the password is incorrect."));

        Institute institute = student.getInstitute();
        return new StudentPortalLoginResponse(
                institute.getId(),
                institute.getInstituteName(),
                institute.getUsername(),
                institute.getType(),
                institute.getLogo(),
                student.getId(),
                student.getSystemId(),
                student.getEnrollmentNo(),
                buildStudentName(student.getFirstName(), student.getLastName())
        );
    }

    public StudentResponse createStudent(Long instituteId, StudentPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateRequiredFields(request);
        validateUniqueness(instituteId, request);
        validatePhoto(request);
        validatePhoneNumbers(request);

        Student student = new Student();
        student.setInstitute(institute);
        applyStudentPayload(student, request);
        Student savedStudent = studentRepository.save(student);
        reassignRollNumbers(instituteId, savedStudent.getAssignedClass());
        return toResponse(findStudent(instituteId, savedStudent.getId()));
    }

    public StudentResponse updateStudent(Long instituteId, Long studentId, StudentPayload request) {
        Student student = findStudent(instituteId, studentId);
        validateRequiredFields(request);
        validateUniquenessForUpdate(instituteId, studentId, request);
        validatePhoto(request);
        validatePhoneNumbers(request);

        String previousAssignedClass = student.getAssignedClass();
        applyStudentPayload(student, request);
        Student savedStudent = studentRepository.save(student);

        if (StringUtils.hasText(previousAssignedClass) && !previousAssignedClass.equalsIgnoreCase(savedStudent.getAssignedClass())) {
            reassignRollNumbers(instituteId, previousAssignedClass);
        }
        reassignRollNumbers(instituteId, savedStudent.getAssignedClass());
        return toResponse(findStudent(instituteId, savedStudent.getId()));
    }

    public List<StudentResponse> importStudents(Long instituteId, List<StudentPayload> students) {
        Institute institute = validateInstitute(instituteId);
        List<Student> entities = students.stream()
                .map(payload -> {
                    validateRequiredFields(payload);
                    validatePhoneNumbers(payload);
                    Student student = new Student();
                    student.setInstitute(institute);
                    applyStudentPayload(student, payload);
                    return student;
                })
                .toList();

        List<Student> savedStudents = studentRepository.saveAll(entities);
        savedStudents.stream()
                .map(Student::getAssignedClass)
                .filter(StringUtils::hasText)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(className -> reassignRollNumbers(instituteId, className));

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

        return toResponse(studentRepository.save(student));
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
        validateInstitute(instituteId);
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private void validateUniqueness(Long instituteId, StudentPayload request) {
        if (StringUtils.hasText(request.email())
                && studentRepository.existsByInstituteIdAndEmailIgnoreCase(instituteId, request.email().trim())) {
            throw new IllegalArgumentException("Student already exists with email: " + request.email());
        }
    }

    private void validateUniquenessForUpdate(Long instituteId, Long studentId, StudentPayload request) {
        if (!StringUtils.hasText(request.email())) {
            return;
        }

        studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .filter(existingStudent -> {
                    String existingEmail = existingStudent.getEmail();
                    return !StringUtils.hasText(existingEmail)
                            || !existingEmail.equalsIgnoreCase(request.email().trim());
                })
                .ifPresent(ignored -> validateUniqueness(instituteId, request));
    }

    private void applyStudentPayload(Student student, StudentPayload request) {
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
        student.setClassName(uppercase(request.className()));
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
        student.setStudentPortalPassword(resolvePortalPassword(student, request));
        student.setDocumentType(uppercase(request.documentType()));
        student.setOtherDocumentName(uppercase(request.otherDocumentName()));
        student.setFileUploadPath(trim(request.fileUploadPath()));
        student.setDocumentsJson(writeDocuments(normalizeDocuments(request.documents())));
        student.setCardExpiryDate(trim(request.cardExpiryDate()));
        student.setPhotoUrl(trim(request.photoUrl()));
        student.setSystemId("EDU-" + student.getEnrollmentNo());
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
                student.getStudentPortalPassword(),
                student.getDocumentType(),
                student.getOtherDocumentName(),
                student.getFileUploadPath(),
                readDocuments(student.getDocumentsJson()),
                student.getQrCodeData(),
                student.getCardExpiryDate(),
                student.getPhotoUrl(),
                student.getSystemId(),
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
        if (StringUtils.hasText(student.getEnrollmentNo())) {
            return student.getEnrollmentNo().trim();
        }

        String instituteCode = buildInstituteCode(student.getInstitute().getInstituteName());
        long nextSequence = studentRepository.countByInstituteId(student.getInstitute().getId()) + 1;
        return instituteCode + "-" + String.format("%04d", nextSequence);
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

    private String resolveFacilityStatus(String optIn, String requestedStatus) {
        if (!"yes".equalsIgnoreCase(optIn)) {
            return "inactive";
        }
        return defaultValue(requestedStatus, "active").toLowerCase();
    }

    private String resolvePortalPassword(Student student, StudentPayload request) {
        if (StringUtils.hasText(request.studentPortalPassword())) {
            return request.studentPortalPassword().trim();
        }

        return resolvePortalPassword(student, null, request.guardianPhone(), request.dob());
    }

    private String resolvePortalPassword(Student student, String explicitPassword, String guardianPhone, String dob) {
        if (StringUtils.hasText(explicitPassword)) {
            return explicitPassword.trim();
        }

        String guardianDigits = digitsOnly(guardianPhone);
        String firstSixGuardianDigits = guardianDigits.length() >= 6
                ? guardianDigits.substring(0, 6)
                : String.format("%-6s", guardianDigits).replace(' ', '0');

        String birthYear = "0000";
        if (StringUtils.hasText(dob) && dob.trim().length() >= 4) {
            birthYear = dob.trim().substring(0, 4);
        }

        return firstSixGuardianDigits + birthYear;
    }

    private String resolveQrCodeData(Student student, StudentPayload request) {
        if (StringUtils.hasText(request.qrCodeData())) {
            return request.qrCodeData().trim();
        }

        String documentSummary = normalizeDocuments(request.documents()).stream()
                .map(document -> firstNonBlank(document.documentType(), firstNonBlank(document.fileName(), document.fileUploadPath())))
                .filter(StringUtils::hasText)
                .toList()
                .stream()
                .reduce((first, second) -> first + ", " + second)
                .orElse("N/A");

        return String.join("\n",
                "ERP STUDENT PROFILE",
                "Name: " + defaultValue(buildStudentName(student.getFirstName(), student.getLastName()), "Student"),
                "Student ID: " + defaultValue(student.getSystemId(), "N/A"),
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

    private String digitsOnly(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.replaceAll("\\D", "");
    }

    private String buildInstituteCode(String instituteName) {
        if (!StringUtils.hasText(instituteName)) {
            return "INST";
        }

        String[] words = instituteName.trim().toUpperCase().split("\\s+");
        StringBuilder initials = new StringBuilder();
        for (String word : words) {
            String cleaned = NON_ALPHANUMERIC.matcher(word).replaceAll("");
            if (!cleaned.isEmpty()) {
                initials.append(cleaned.charAt(0));
            }
        }

        if (initials.length() >= 2) {
            return initials.substring(0, Math.min(initials.length(), 6));
        }

        String compact = NON_ALPHANUMERIC.matcher(instituteName.toUpperCase()).replaceAll("");
        if (compact.isEmpty()) {
            return "INST";
        }

        return compact.substring(0, Math.min(compact.length(), 6));
    }

    private void reassignRollNumbers(Long instituteId, String assignedClass) {
        if (!StringUtils.hasText(assignedClass)) {
            return;
        }

        List<Student> classStudents = studentRepository
                .findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByFirstNameAscLastNameAscCreatedAtAsc(instituteId, assignedClass);

        for (int index = 0; index < classStudents.size(); index++) {
            classStudents.get(index).setRollNo(String.format("%03d", index + 1));
        }

        studentRepository.saveAll(classStudents);
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
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
