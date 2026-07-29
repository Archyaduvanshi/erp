package com.erp.backend.student.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

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
        validateUniqueness(instituteId, request);
        validatePhoto(request);

        Student student = new Student();
        student.setInstitute(institute);
        applyStudentPayload(student, request);
        Student savedStudent = studentRepository.save(student);
        reassignRollNumbers(instituteId, savedStudent.getAssignedClass());
        return toResponse(findStudent(instituteId, savedStudent.getId()));
    }

    public StudentResponse updateStudent(Long instituteId, Long studentId, StudentPayload request) {
        Student student = findStudent(instituteId, studentId);
        validateUniquenessForUpdate(instituteId, studentId, request);
        validatePhoto(request);

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
        student.setFirstName(trim(request.firstName()));
        student.setLastName(trim(request.lastName()));
        student.setName(buildStudentName(request.firstName(), request.lastName()));
        student.setDob(trim(request.dob()));
        student.setGender(trim(request.gender()));
        student.setEmail(normalizeEmail(request.email()));
        student.setMobile(trim(request.mobile()));
        student.setBloodGroup(trim(request.bloodGroup()));
        student.setAddress(trim(request.address()));
        student.setGuardianName(trim(request.guardianName()));
        student.setMotherName(trim(request.motherName()));
        student.setGuardianPhone(trim(request.guardianPhone()));
        student.setPrevSchool(trim(request.prevSchool()));
        student.setCategory(trim(request.category()));
        String today = LocalDate.now().toString();
        student.setRegDate(resolveDate(request.regDate(), today));
        student.setAdmissionDate(resolveDate(request.admissionDate(), today));
        student.setEnrollmentNo(resolveEnrollmentNo(student, request));
        student.setClassName(trim(request.className()));
        student.setSection(trim(request.section()));
        student.setAssignedClass(resolveAssignedClass(request));
        student.setAdmissionCategory(trim(request.admissionCategory()));
        student.setTransportOptIn(defaultValue(request.transportOptIn(), "no"));
        student.setHostelOptIn(defaultValue(request.hostelOptIn(), "no"));
        student.setLibraryOptIn(defaultValue(request.libraryOptIn(), "no"));
        student.setTransportStatus(defaultValue(request.transportStatus(), "inactive"));
        student.setHostelStatus(defaultValue(request.hostelStatus(), "inactive"));
        student.setLibraryStatus(defaultValue(request.libraryStatus(), "inactive"));
        student.setLibraryMonthlyCharge(trim(request.libraryMonthlyCharge()));
        student.setStudentPortalPassword(resolvePortalPassword(student, request));
        student.setDocumentType(trim(request.documentType()));
        student.setOtherDocumentName(trim(request.otherDocumentName()));
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
                student.getGuardianName(),
                student.getMotherName(),
                student.getGuardianPhone(),
                student.getPrevSchool(),
                student.getCategory(),
                student.getAdmissionDate(),
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

    private void validatePhoto(StudentPayload request) {
        if (!StringUtils.hasText(request.photoUrl())) {
            throw new IllegalArgumentException("Student photo upload is required.");
        }
    }

    private String resolveDate(String requestedDate, String fallback) {
        return StringUtils.hasText(requestedDate) ? requestedDate.trim() : fallback;
    }

    private String resolveEnrollmentNo(Student student, StudentPayload request) {
        if (StringUtils.hasText(request.enrollmentNo())) {
            return request.enrollmentNo().trim();
        }

        String instituteCode = buildInstituteCode(student.getInstitute().getInstituteName());
        long nextSequence = studentRepository.countByInstituteId(student.getInstitute().getId()) + 1;
        return instituteCode + "-" + String.format("%04d", nextSequence);
    }

    private String resolveAssignedClass(StudentPayload request) {
        if (StringUtils.hasText(request.className()) && StringUtils.hasText(request.section())) {
            return request.className().trim() + " / " + request.section().trim();
        }
        if (StringUtils.hasText(request.className())) {
            return request.className().trim();
        }
        if (StringUtils.hasText(request.assignedClass())) {
            return request.assignedClass().trim();
        }
        return null;
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
                "Guardian: " + defaultValue(student.getGuardianName(), "N/A"),
                "Guardian Phone: " + defaultValue(student.getGuardianPhone(), "N/A"),
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
