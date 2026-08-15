package com.erp.backend.teacher.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.teacher.dto.TeacherDocumentPayload;
import com.erp.backend.teacher.dto.TeacherPayload;
import com.erp.backend.teacher.dto.TeacherPaymentPayload;
import com.erp.backend.teacher.dto.TeacherPortalLoginRequest;
import com.erp.backend.teacher.dto.TeacherPortalLoginResponse;
import com.erp.backend.teacher.dto.TeacherResponse;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class TeacherService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^A-Z0-9]");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern ONE_OR_TWO_DIGITS = Pattern.compile("^\\d{1,2}$");

    private final TeacherRepository teacherRepository;
    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    public TeacherService(
            TeacherRepository teacherRepository,
            InstituteRepository instituteRepository,
            ObjectMapper objectMapper
    ) {
        this.teacherRepository = teacherRepository;
        this.instituteRepository = instituteRepository;
        this.objectMapper = objectMapper;
    }

    public List<TeacherResponse> getAllTeachers(Long instituteId) {
        validateInstitute(instituteId);
        return teacherRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public TeacherResponse getTeacherById(Long instituteId, Long teacherId) {
        return toResponse(findTeacher(instituteId, teacherId));
    }

    public TeacherPortalLoginResponse loginTeacher(TeacherPortalLoginRequest request) {
        String identifier = request.identifier().trim();
        String password = request.password().trim();

        Teacher teacher = teacherRepository
                .findAllByTeacherSystemIdIgnoreCaseOrEmployeeIdIgnoreCaseOrMobileNumber(identifier, identifier, identifier)
                .stream()
                .filter(candidate -> password.equals(resolvePortalPassword(candidate, candidate.getTeacherPortalPassword(), candidate.getMobileNumber(), candidate.getDob())))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Invalid teacher ID or phone number, or the password is incorrect."));

        Institute institute = teacher.getInstitute();
        return new TeacherPortalLoginResponse(
                institute.getId(),
                institute.getInstituteName(),
                institute.getUsername(),
                institute.getType(),
                institute.getLogo(),
                teacher.getId(),
                teacher.getTeacherSystemId(),
                teacher.getEmployeeId(),
                buildTeacherName(teacher.getFirstName(), teacher.getLastName())
        );
    }

    public TeacherResponse createTeacher(Long instituteId, TeacherPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateTeacherPayload(request);
        validateUniqueness(instituteId, request);
        validatePhoto(request);

        Teacher teacher = new Teacher();
        teacher.setInstitute(institute);
        applyTeacherPayload(teacher, request);
        return toResponse(teacherRepository.save(teacher));
    }

    public TeacherResponse updateTeacher(Long instituteId, Long teacherId, TeacherPayload request) {
        Teacher teacher = findTeacher(instituteId, teacherId);
        validateTeacherPayload(request);
        validateUniquenessForUpdate(instituteId, teacherId, request);
        validatePhoto(request);

        applyTeacherPayload(teacher, request);
        return toResponse(teacherRepository.save(teacher));
    }

    public List<TeacherResponse> importTeachers(Long instituteId, List<TeacherPayload> teachers) {
        Institute institute = validateInstitute(instituteId);
        List<Teacher> entities = teachers.stream()
                .map(payload -> {
                    validateTeacherPayload(payload);
                    Teacher teacher = new Teacher();
                    teacher.setInstitute(institute);
                    applyTeacherPayload(teacher, payload);
                    return teacher;
                })
                .toList();

        teacherRepository.saveAll(entities);
        return getAllTeachers(instituteId);
    }

    public void deleteTeacher(Long instituteId, Long teacherId) {
        Teacher teacher = findTeacher(instituteId, teacherId);
        teacherRepository.delete(teacher);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Teacher findTeacher(Long instituteId, Long teacherId) {
        validateInstitute(instituteId);
        return teacherRepository.findByInstituteIdAndId(instituteId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherId));
    }

    private void validateUniqueness(Long instituteId, TeacherPayload request) {
        String nextEmail = normalizeEmail(request.personalEmail());
        String mobileNumber = digitsOnly(request.mobileNumber());
        String nextEmployeeId = trim(request.employeeId());

        teacherRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .forEach(teacher -> {
                    if (StringUtils.hasText(nextEmail)
                            && nextEmail.equalsIgnoreCase(defaultValue(teacher.getPersonalEmail(), ""))) {
                        throw new IllegalArgumentException("Teacher already exists with email: " + request.personalEmail());
                    }
                    if (StringUtils.hasText(mobileNumber)
                            && mobileNumber.equals(digitsOnly(teacher.getMobileNumber()))) {
                        throw new IllegalArgumentException("Teacher already exists with mobile number: " + mobileNumber);
                    }
                    if (StringUtils.hasText(nextEmployeeId)
                            && nextEmployeeId.equalsIgnoreCase(defaultValue(teacher.getEmployeeId(), ""))) {
                        throw new IllegalArgumentException("Teacher already exists with employee ID: " + request.employeeId());
                    }
                });
    }

    private void validateUniquenessForUpdate(Long instituteId, Long teacherId, TeacherPayload request) {
        String nextEmail = normalizeEmail(request.personalEmail());
        String nextMobile = digitsOnly(request.mobileNumber());
        String nextEmployeeId = trim(request.employeeId());

        teacherRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .filter(teacher -> !Objects.equals(teacher.getId(), teacherId))
                .forEach(teacher -> {
                    if (StringUtils.hasText(nextEmail)
                            && nextEmail.equalsIgnoreCase(defaultValue(teacher.getPersonalEmail(), ""))) {
                        throw new IllegalArgumentException("Teacher already exists with email: " + request.personalEmail());
                    }
                    if (StringUtils.hasText(nextMobile)
                            && nextMobile.equals(digitsOnly(teacher.getMobileNumber()))) {
                        throw new IllegalArgumentException("Teacher already exists with mobile number: " + nextMobile);
                    }
                    if (StringUtils.hasText(nextEmployeeId)
                            && nextEmployeeId.equalsIgnoreCase(defaultValue(teacher.getEmployeeId(), ""))) {
                        throw new IllegalArgumentException("Teacher already exists with employee ID: " + request.employeeId());
                    }
                });
    }

    private void validateTeacherPayload(TeacherPayload request) {
        if (!StringUtils.hasText(request.firstName())) {
            throw new IllegalArgumentException("First name is required.");
        }

        String email = normalizeEmail(request.personalEmail());
        if (!StringUtils.hasText(email)) {
            throw new IllegalArgumentException("Personal email is required.");
        }
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("Enter a valid personal email address.");
        }

        String mobileNumber = digitsOnly(request.mobileNumber());
        if (mobileNumber.length() != 10) {
            throw new IllegalArgumentException("Mobile number must be exactly 10 digits.");
        }

        if (!StringUtils.hasText(request.dob())) {
            throw new IllegalArgumentException("Date of birth is required.");
        }
        if (!StringUtils.hasText(request.address())) {
            throw new IllegalArgumentException("Address is required.");
        }
        if (!StringUtils.hasText(request.city())) {
            throw new IllegalArgumentException("City is required.");
        }
        if (!StringUtils.hasText(request.state())) {
            throw new IllegalArgumentException("State is required.");
        }
        if (digitsOnly(request.pincode()).length() != 6) {
            throw new IllegalArgumentException("Pincode must be exactly 6 digits.");
        }
        if (!StringUtils.hasText(request.specialization())) {
            throw new IllegalArgumentException("Specialization is required.");
        }

        String experienceYears = digitsOnly(request.experienceYears());
        if (!ONE_OR_TWO_DIGITS.matcher(experienceYears).matches()) {
            throw new IllegalArgumentException("Experience years must be a one or two digit number.");
        }
        if (!StringUtils.hasText(request.contractType())) {
            throw new IllegalArgumentException("Contract type is required.");
        }
        if (!StringUtils.hasText(request.salary())) {
            throw new IllegalArgumentException("Monthly salary is required.");
        }
    }

    private void applyTeacherPayload(Teacher teacher, TeacherPayload request) {
        teacher.setFirstName(upper(request.firstName()));
        teacher.setLastName(upper(request.lastName()));
        teacher.setName(buildTeacherName(teacher.getFirstName(), teacher.getLastName()));
        teacher.setPersonalEmail(normalizeEmail(request.personalEmail()));
        teacher.setMobileNumber(digitsOnly(request.mobileNumber()));
        teacher.setEmployeeId(resolveEmployeeId(teacher, request));
        teacher.setAddress(upper(request.address()));
        teacher.setCity(upper(request.city()));
        teacher.setState(upper(request.state()));
        teacher.setPincode(digitsOnly(request.pincode()));
        teacher.setSpecialization(upper(request.specialization()));
        teacher.setExperienceYears(digitsOnly(request.experienceYears()));
        teacher.setContractType(upper(defaultValue(request.contractType(), "FULL TIME")));
        teacher.setLeaveBalance(trim(request.leaveBalance()));
        teacher.setSalary(trim(request.salary()));
        teacher.setDob(trim(request.dob()));
        teacher.setJoiningDate(resolveDate(teacher.getJoiningDate(), LocalDate.now().toString()));
        teacher.setTeacherPortalPassword(resolvePortalPassword(teacher, request));
        teacher.setDocumentType(trim(request.documentType()));
        teacher.setOtherDocumentName(trim(request.otherDocumentName()));
        teacher.setFileUploadPath(trim(request.fileUploadPath()));
        teacher.setDocumentsJson(writeDocuments(normalizeDocuments(request.documents())));
        teacher.setPaymentHistoryJson(writePaymentHistory(request.paymentHistory()));
        teacher.setCardExpiryDate(trim(request.cardExpiryDate()));
        teacher.setPhotoUrl(trim(request.photoUrl()));
        teacher.setTeacherSystemId(resolveTeacherSystemId(teacher, request));
        teacher.setQrCodeData(resolveQrCodeData(teacher, request));
        teacher.setStatus(defaultValue(request.status(), "Active"));
        teacher.setAttendanceStatus(defaultValue(request.attendanceStatus(), "Present"));
    }

    private TeacherResponse toResponse(Teacher teacher) {
        return new TeacherResponse(
                teacher.getId(),
                teacher.getFirstName(),
                teacher.getLastName(),
                teacher.getPersonalEmail(),
                teacher.getMobileNumber(),
                teacher.getEmployeeId(),
                teacher.getAddress(),
                teacher.getCity(),
                teacher.getState(),
                teacher.getPincode(),
                teacher.getSpecialization(),
                teacher.getExperienceYears(),
                teacher.getContractType(),
                teacher.getLeaveBalance(),
                teacher.getSalary(),
                teacher.getDob(),
                teacher.getJoiningDate(),
                teacher.getTeacherPortalPassword(),
                teacher.getDocumentType(),
                teacher.getOtherDocumentName(),
                teacher.getFileUploadPath(),
                readDocuments(teacher.getDocumentsJson()),
                readPaymentHistory(teacher.getPaymentHistoryJson()),
                teacher.getQrCodeData(),
                teacher.getCardExpiryDate(),
                teacher.getPhotoUrl(),
                teacher.getTeacherSystemId(),
                defaultValue(teacher.getStatus(), "Active"),
                defaultValue(teacher.getAttendanceStatus(), "Present"),
                teacher.getCreatedAt(),
                teacher.getUpdatedAt()
        );
    }

    private List<TeacherDocumentPayload> readDocuments(String documentsJson) {
        if (!StringUtils.hasText(documentsJson)) {
            return List.of();
        }

        try {
            return objectMapper.readValue(documentsJson, new TypeReference<List<TeacherDocumentPayload>>() {
            });
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read teacher documents.", exception);
        }
    }

    private String writeDocuments(List<TeacherDocumentPayload> documents) {
        try {
            return objectMapper.writeValueAsString(documents == null ? List.of() : documents);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to save teacher documents.", exception);
        }
    }

    private List<TeacherDocumentPayload> normalizeDocuments(List<TeacherDocumentPayload> documents) {
        if (documents == null) {
            return List.of();
        }

        return documents.stream()
                .filter(Objects::nonNull)
                .map(document -> new TeacherDocumentPayload(
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

    private List<TeacherPaymentPayload> readPaymentHistory(String paymentHistoryJson) {
        if (!StringUtils.hasText(paymentHistoryJson)) {
            return List.of();
        }

        try {
            return objectMapper.readValue(paymentHistoryJson, new TypeReference<List<TeacherPaymentPayload>>() {
            });
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read teacher payment history.", exception);
        }
    }

    private String writePaymentHistory(List<TeacherPaymentPayload> paymentHistory) {
        try {
            return objectMapper.writeValueAsString(paymentHistory == null ? List.of() : paymentHistory);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to save teacher payment history.", exception);
        }
    }

    private void validatePhoto(TeacherPayload request) {
        if (!StringUtils.hasText(request.photoUrl())) {
            throw new IllegalArgumentException("Teacher photo upload is required.");
        }
    }

    private String resolveDate(String requestedDate, String fallback) {
        return StringUtils.hasText(requestedDate) ? requestedDate.trim() : fallback;
    }

    private String resolveEmployeeId(Teacher teacher, TeacherPayload request) {
        if (StringUtils.hasText(request.employeeId())) {
            return request.employeeId().trim();
        }

        String instituteCode = buildInstituteCode(teacher.getInstitute().getInstituteName());
        long nextSequence = teacherRepository.countByInstituteId(teacher.getInstitute().getId()) + 1;
        return instituteCode + "EMP" + String.format("%04d", nextSequence);
    }

    private String resolveTeacherSystemId(Teacher teacher, TeacherPayload request) {
        if (StringUtils.hasText(request.teacherSystemId())) {
            return request.teacherSystemId().trim();
        }

        return "TCH-" + resolveEmployeeId(teacher, request);
    }

    private String resolvePortalPassword(Teacher teacher, TeacherPayload request) {
        if (StringUtils.hasText(request.teacherPortalPassword())) {
            return request.teacherPortalPassword().trim();
        }

        return resolvePortalPassword(teacher, null, request.mobileNumber(), request.dob());
    }

    private String resolvePortalPassword(Teacher teacher, String explicitPassword, String mobileNumber, String dob) {
        if (StringUtils.hasText(explicitPassword)) {
            return explicitPassword.trim();
        }

        String mobileDigits = digitsOnly(mobileNumber);
        String firstSixMobileDigits = mobileDigits.length() >= 6
                ? mobileDigits.substring(0, 6)
                : String.format("%-6s", mobileDigits).replace(' ', '0');

        String birthYear = "0000";
        if (StringUtils.hasText(dob) && dob.trim().length() >= 4) {
            birthYear = dob.trim().substring(0, 4);
        }

        return firstSixMobileDigits + birthYear;
    }

    private String resolveQrCodeData(Teacher teacher, TeacherPayload request) {
        if (StringUtils.hasText(request.qrCodeData())) {
            return request.qrCodeData().trim();
        }

        Map<String, Object> qrPayload = new LinkedHashMap<>();
        qrPayload.put("profileType", "teacher");
        qrPayload.put("teacherId", teacher.getTeacherSystemId());
        qrPayload.put("employeeId", teacher.getEmployeeId());
        qrPayload.put("fullName", buildTeacherName(teacher.getFirstName(), teacher.getLastName()));
        qrPayload.put("email", teacher.getPersonalEmail());
        qrPayload.put("mobile", teacher.getMobileNumber());
        qrPayload.put("dob", teacher.getDob());
        qrPayload.put("specialization", teacher.getSpecialization());
        qrPayload.put("experienceYears", teacher.getExperienceYears());
        qrPayload.put("contractType", teacher.getContractType());
        qrPayload.put("joiningDate", teacher.getJoiningDate());
        qrPayload.put("address", teacher.getAddress());
        qrPayload.put("city", teacher.getCity());
        qrPayload.put("state", teacher.getState());
        qrPayload.put("pincode", teacher.getPincode());

        try {
            return objectMapper.writeValueAsString(qrPayload);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to generate teacher QR payload.", exception);
        }
    }

    private String normalizeEmail(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase() : null;
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

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String upper(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase() : null;
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

    private String buildTeacherName(String firstName, String lastName) {
        String resolvedFirstName = trim(firstName);
        String resolvedLastName = trim(lastName);
        String fullName = String.join(" ",
                resolvedFirstName == null ? "" : resolvedFirstName,
                resolvedLastName == null ? "" : resolvedLastName).trim();
        return StringUtils.hasText(fullName) ? fullName : "Teacher";
    }
}
