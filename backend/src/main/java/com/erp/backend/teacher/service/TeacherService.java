package com.erp.backend.teacher.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import com.erp.backend.auth.AuthService;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.institute.service.InstitutionCodeService;
import com.erp.backend.salary.entity.TeacherSalaryProfile;
import com.erp.backend.salary.repository.TeacherSalaryProfileRepository;
import com.erp.backend.scanner.service.QrIdentityTokenService;
import com.erp.backend.scanner.service.QrIdentityTokenService.EntityType;
import com.erp.backend.platform.service.PlanLimitService;
import com.erp.backend.platform.service.PlanLimitService.Resource;
import com.erp.backend.teacher.dto.TeacherDocumentPayload;
import com.erp.backend.teacher.dto.TeacherListResponse;
import com.erp.backend.teacher.dto.TeacherPageResponse;
import com.erp.backend.teacher.dto.TeacherPayload;
import com.erp.backend.teacher.dto.TeacherPaymentPayload;
import com.erp.backend.teacher.dto.TeacherOptionResponse;
import com.erp.backend.teacher.dto.TeacherPortalLoginRequest;
import com.erp.backend.teacher.dto.TeacherPortalLoginResponse;
import com.erp.backend.teacher.dto.TeacherResponse;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TeacherService {
    private static final java.util.regex.Pattern EMAIL_PATTERN = java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final java.util.regex.Pattern ONE_OR_TWO_DIGITS = java.util.regex.Pattern.compile("^\\d{1,2}$");
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "createdAt",
            "name",
            "firstName",
            "lastName",
            "employeeId",
            "joiningDate"
    );

    private final TeacherRepository teacherRepository;
    private final InstituteRepository instituteRepository;
    private final TeacherSalaryProfileRepository salaryProfileRepository;
    private final ObjectMapper objectMapper;
    private final AuthService authService;
    private final InstitutionCodeService institutionCodeService;
    private final QrIdentityTokenService qrIdentityTokenService;
    private final PlanLimitService planLimitService;

    public TeacherService(
            TeacherRepository teacherRepository,
            InstituteRepository instituteRepository,
            TeacherSalaryProfileRepository salaryProfileRepository,
            ObjectMapper objectMapper,
            AuthService authService,
            InstitutionCodeService institutionCodeService,
            QrIdentityTokenService qrIdentityTokenService,
            PlanLimitService planLimitService
    ) {
        this.teacherRepository = teacherRepository;
        this.instituteRepository = instituteRepository;
        this.salaryProfileRepository = salaryProfileRepository;
        this.objectMapper = objectMapper;
        this.authService = authService;
        this.institutionCodeService = institutionCodeService;
        this.qrIdentityTokenService = qrIdentityTokenService;
        this.planLimitService = planLimitService;
    }

    public List<TeacherResponse> getAllTeachers(Long instituteId) {
        validateInstitute(instituteId);
        return teacherRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public TeacherPageResponse<TeacherListResponse> getTeachersPage(
            Long instituteId,
            Integer page,
            Integer size,
            String search,
            String status,
            String specialization,
            String contractType,
            String sort
    ) {
        validateInstitute(instituteId);
        Pageable pageable = PageRequest.of(
                Math.max(page == null ? 0 : page, 0),
                normalizePageSize(size),
                parseSort(sort)
        );

        Page<TeacherListResponse> teachers = teacherRepository.findTeacherList(
                instituteId,
                blankToEmpty(search),
                blankToEmpty(status),
                blankToEmpty(specialization),
                blankToEmpty(contractType),
                pageable
        );

        return new TeacherPageResponse<>(
                teachers.getContent(),
                teachers.getNumber(),
                teachers.getSize(),
                teachers.getTotalElements(),
                teachers.getTotalPages()
        );
    }

    public TeacherResponse getTeacherById(Long instituteId, Long teacherId) {
        return toResponse(findTeacher(instituteId, teacherId));
    }

    public List<TeacherOptionResponse> getTeacherOptions(Long instituteId, String status) {
        validateInstitute(instituteId);
        return teacherRepository.findTeacherOptions(instituteId, defaultValue(status, "Active"));
    }

    public TeacherPortalLoginResponse loginTeacher(TeacherPortalLoginRequest request) {
        throw new IllegalArgumentException("Teacher portal login has moved to the main login. Use your teacher ID and password.");
    }

    @Transactional
    public TeacherResponse createTeacher(Long instituteId, TeacherPayload request) {
        planLimitService.assertCanAdd(instituteId, Resource.TEACHERS, 1);
        Institute institute = validateInstitute(instituteId);
        validateTeacherPayload(request);
        validateUniqueness(instituteId, request);
        validatePhoto(request);

        Teacher teacher = new Teacher();
        teacher.setInstitute(institute);
        applyTeacherPayload(teacher, request);
        teacher.setQrCodeData(qrIdentityTokenService.generate(EntityType.TEACHER));
        try {
            Teacher savedTeacher = teacherRepository.save(teacher);
            syncSalaryProfile(savedTeacher);
            authService.upsertTeacherAccount(savedTeacher, null, true);
            return toResponse(savedTeacher);
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalArgumentException("Teacher employee ID, email, or mobile number already exists.");
        }
    }

    @Transactional
    public TeacherResponse updateTeacher(Long instituteId, Long teacherId, TeacherPayload request) {
        Teacher teacher = findTeacher(instituteId, teacherId);
        if ("archived".equalsIgnoreCase(teacher.getStatus()) && !"archived".equalsIgnoreCase(request.status()))
            planLimitService.assertCanAdd(instituteId, Resource.TEACHERS, 1);
        validateTeacherPayload(request);
        validateUniquenessForUpdate(instituteId, teacherId, request);
        validatePhoto(request);

        applyTeacherPayload(teacher, request);
        try {
            Teacher savedTeacher = teacherRepository.save(teacher);
            syncSalaryProfile(savedTeacher);
            authService.upsertTeacherAccount(savedTeacher, null, false);
            return toResponse(savedTeacher);
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalArgumentException("Teacher employee ID, email, or mobile number already exists.");
        }
    }

    @Transactional
    public List<TeacherResponse> importTeachers(Long instituteId, List<TeacherPayload> teachers) {
        planLimitService.assertCanAdd(instituteId, Resource.TEACHERS, teachers == null ? 0 : teachers.size());
        Institute institute = validateInstitute(instituteId);
        List<Teacher> entities = teachers.stream()
                .map(payload -> {
                    validateTeacherPayload(payload);
                    Teacher teacher = new Teacher();
                    teacher.setInstitute(institute);
                    applyTeacherPayload(teacher, payload);
                    teacher.setQrCodeData(qrIdentityTokenService.generate(EntityType.TEACHER));
                    return teacher;
                })
                .toList();

        teacherRepository.saveAll(entities).forEach(teacher -> {
            syncSalaryProfile(teacher);
            authService.upsertTeacherAccount(teacher, null, true);
        });
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
        return teacherRepository.findByInstituteIdAndId(instituteId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherId));
    }

    private void validateUniqueness(Long instituteId, TeacherPayload request) {
        String nextEmail = normalizeEmail(request.personalEmail());
        String mobileNumber = digitsOnly(request.mobileNumber());
        String nextEmployeeId = trim(request.employeeId());

        if (StringUtils.hasText(nextEmail)
                && teacherRepository.existsByInstituteIdAndPersonalEmailIgnoreCase(instituteId, nextEmail)) {
            throw new IllegalArgumentException("Teacher already exists with email: " + request.personalEmail());
        }
        if (StringUtils.hasText(mobileNumber)
                && teacherRepository.existsByInstituteIdAndMobileNumber(instituteId, mobileNumber)) {
            throw new IllegalArgumentException("Teacher already exists with mobile number: " + mobileNumber);
        }
        if (StringUtils.hasText(nextEmployeeId)
                && teacherRepository.existsByInstituteIdAndEmployeeIdIgnoreCase(instituteId, nextEmployeeId)) {
            throw new IllegalArgumentException("Teacher already exists with employee ID: " + request.employeeId());
        }
    }

    private void validateUniquenessForUpdate(Long instituteId, Long teacherId, TeacherPayload request) {
        String nextEmail = normalizeEmail(request.personalEmail());
        String nextMobile = digitsOnly(request.mobileNumber());
        String nextEmployeeId = trim(request.employeeId());

        if (StringUtils.hasText(nextEmail)
                && teacherRepository.existsByInstituteIdAndPersonalEmailIgnoreCaseAndIdNot(instituteId, nextEmail, teacherId)) {
            throw new IllegalArgumentException("Teacher already exists with email: " + request.personalEmail());
        }
        if (StringUtils.hasText(nextMobile)
                && teacherRepository.existsByInstituteIdAndMobileNumberAndIdNot(instituteId, nextMobile, teacherId)) {
            throw new IllegalArgumentException("Teacher already exists with mobile number: " + nextMobile);
        }
        if (StringUtils.hasText(nextEmployeeId)
                && teacherRepository.existsByInstituteIdAndEmployeeIdIgnoreCaseAndIdNot(instituteId, nextEmployeeId, teacherId)) {
            throw new IllegalArgumentException("Teacher already exists with employee ID: " + request.employeeId());
        }
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
        teacher.setSalaryAmount(parseSalaryAmount(request.salary()));
        teacher.setDob(trim(request.dob()));
        teacher.setJoiningDate(resolveDate(request.joiningDate(), StringUtils.hasText(teacher.getJoiningDate()) ? teacher.getJoiningDate() : LocalDate.now().toString()));
        teacher.setDocumentType(trim(request.documentType()));
        teacher.setOtherDocumentName(trim(request.otherDocumentName()));
        teacher.setFileUploadPath(trim(request.fileUploadPath()));
        teacher.setDocumentsJson(writeDocuments(normalizeDocuments(request.documents())));
        teacher.setPaymentHistoryJson(writePaymentHistory(request.paymentHistory()));
        teacher.setCardExpiryDate(trim(request.cardExpiryDate()));
        teacher.setPhotoUrl(trim(request.photoUrl()));
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
                teacher.getDocumentType(),
                teacher.getOtherDocumentName(),
                teacher.getFileUploadPath(),
                readDocuments(teacher.getDocumentsJson()),
                readPaymentHistory(teacher.getPaymentHistoryJson()),
                teacher.getQrCodeData(),
                teacher.getCardExpiryDate(),
                teacher.getPhotoUrl(),
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

    private void syncSalaryProfile(Teacher teacher) {
        BigDecimal amount = parseSalaryAmount(teacher.getSalary());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        LocalDate effectiveFrom = parseLocalDate(teacher.getJoiningDate(), LocalDate.now());
        salaryProfileRepository.findCurrentOpenProfile(teacher.getInstitute().getId(), teacher.getId())
                .ifPresentOrElse(existing -> {
                    if (amount.compareTo(existing.getBaseSalary()) == 0) return;
                    if (existing.getEffectiveFrom() != null && existing.getEffectiveFrom().equals(effectiveFrom)) {
                        existing.setBaseSalary(amount);
                        salaryProfileRepository.save(existing);
                        return;
                    }
                    if (existing.getEffectiveFrom() != null && !effectiveFrom.isAfter(existing.getEffectiveFrom())) {
                        throw new IllegalArgumentException("OVERLAPPING_SALARY_PROFILE: Salary effective date must be after the current salary profile start date.");
                    }
                    existing.setEffectiveTo(effectiveFrom.minusDays(1));
                    salaryProfileRepository.save(existing);
                    TeacherSalaryProfile nextProfile = newSalaryProfile(teacher, amount, effectiveFrom);
                    validateNoSalaryProfileOverlap(nextProfile, null);
                    salaryProfileRepository.save(nextProfile);
                }, () -> {
                    TeacherSalaryProfile nextProfile = newSalaryProfile(teacher, amount, effectiveFrom);
                    validateNoSalaryProfileOverlap(nextProfile, null);
                    salaryProfileRepository.save(nextProfile);
                });
    }

    private void validateNoSalaryProfileOverlap(TeacherSalaryProfile profile, Long excludedId) {
        LocalDate effectiveTo = profile.getEffectiveTo() == null ? LocalDate.of(9999, 12, 31) : profile.getEffectiveTo();
        if (salaryProfileRepository.existsOverlappingActiveProfile(
                profile.getInstitute().getId(),
                profile.getTeacher().getId(),
                profile.getEffectiveFrom(),
                effectiveTo,
                LocalDate.of(9999, 12, 31),
                excludedId
        )) {
            throw new IllegalArgumentException("OVERLAPPING_SALARY_PROFILE: Salary profile dates overlap with an existing active profile.");
        }
    }

    private TeacherSalaryProfile newSalaryProfile(Teacher teacher, BigDecimal amount, LocalDate effectiveFrom) {
        TeacherSalaryProfile profile = new TeacherSalaryProfile();
        profile.setInstitute(teacher.getInstitute());
        profile.setTeacher(teacher);
        profile.setBaseSalary(amount);
        profile.setEffectiveFrom(effectiveFrom);
        profile.setStatus("ACTIVE");
        return profile;
    }

    private String resolveDate(String requestedDate, String fallback) {
        return StringUtils.hasText(requestedDate) ? requestedDate.trim() : fallback;
    }

    private String resolveEmployeeId(Teacher teacher, TeacherPayload request) {
        if (StringUtils.hasText(request.employeeId())) {
            return request.employeeId().trim();
        }

        String instituteCode = institutionCodeService.tenantPrefix(teacher.getInstitute().getInstitutionCode());
        long nextSequence = teacherRepository.countByInstituteId(teacher.getInstitute().getId()) + 1;
        return instituteCode + "EMP" + String.format("%04d", nextSequence);
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

    private String normalizeEmail(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase() : null;
    }

    private String digitsOnly(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.replaceAll("\\D", "");
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private BigDecimal parseSalaryAmount(String value) {
        if (!StringUtils.hasText(value)) return BigDecimal.ZERO;
        try {
            return new BigDecimal(value.replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }

    private LocalDate parseLocalDate(String value, LocalDate fallback) {
        if (!StringUtils.hasText(value)) return fallback;
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception exception) {
            return fallback;
        }
    }

    private String blankToEmpty(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
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
