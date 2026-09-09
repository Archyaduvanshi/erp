package com.erp.backend.settings.service;

import java.util.List;
import java.util.Map;

import com.erp.backend.auth.AuthCookieSupport;
import com.erp.backend.auth.AuthService;
import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.dto.AuthTokenPair;
import com.erp.backend.auth.entity.UserAccount;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.settings.dto.AcademicYearResponse;
import com.erp.backend.settings.dto.CollegeSettingsResponse;
import com.erp.backend.settings.dto.FeatureAccessPayload;
import com.erp.backend.settings.dto.FeatureAccessResponse;
import com.erp.backend.settings.dto.FeatureLoginRequest;
import com.erp.backend.settings.dto.FeatureLoginResponse;
import com.erp.backend.settings.dto.NotificationsPayload;
import com.erp.backend.settings.dto.PreferencesPayload;
import com.erp.backend.settings.dto.UnifiedLoginRequest;
import com.erp.backend.settings.dto.UnifiedLoginResponse;
import com.erp.backend.settings.entity.CollegeSettings;
import com.erp.backend.settings.entity.FeatureAccess;
import com.erp.backend.settings.repository.CollegeSettingsRepository;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class CollegeSettingsService {

    private final InstituteRepository instituteRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final CollegeSettingsRepository collegeSettingsRepository;
    private final FeatureAccessRepository featureAccessRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final AuthCookieSupport authCookieSupport;
    private final ClientIpResolver clientIpResolver;

    public CollegeSettingsService(
            InstituteRepository instituteRepository,
            TeacherRepository teacherRepository,
            StudentRepository studentRepository,
            CollegeSettingsRepository collegeSettingsRepository,
            FeatureAccessRepository featureAccessRepository,
            PasswordEncoder passwordEncoder,
            AuthService authService,
            AuthCookieSupport authCookieSupport,
            ClientIpResolver clientIpResolver
    ) {
        this.instituteRepository = instituteRepository;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
        this.collegeSettingsRepository = collegeSettingsRepository;
        this.featureAccessRepository = featureAccessRepository;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.authCookieSupport = authCookieSupport;
        this.clientIpResolver = clientIpResolver;
    }

    public CollegeSettingsResponse getSettings(Long instituteId) {
        Institute institute = validateInstitute(instituteId);
        CollegeSettings settings = resolveSettings(institute);
        return toResponse(settings);
    }

    public AcademicYearResponse getAcademicYear(Long instituteId) {
        CollegeSettings settings = resolveSettings(validateInstitute(instituteId));
        return new AcademicYearResponse(defaultValue(settings.getAcademicYear(), "2026-2027"));
    }

    public CollegeSettingsResponse savePreferences(Long instituteId, PreferencesPayload request) {
        CollegeSettings settings = resolveSettings(validateInstitute(instituteId));
        settings.setAcademicYear(normalize(request.academicYear()));
        settings.setAcademicYearStartMonth(normalize(request.academicYearStartMonth()));
        settings.setAcademicYearEndMonth(normalize(request.academicYearEndMonth()));
        settings.setWorkingDays(normalize(request.workingDays()));
        settings.setTimezone(normalize(request.timezone()));
        settings.setLanguage(normalize(request.language()));
        settings.setDateFormat(normalize(request.dateFormat()));
        settings.setCurrency(normalize(request.currency()));
        settings.setTheme(normalize(request.theme()));
        settings.setStudentCodePrefix(normalizeUppercase(request.studentCodePrefix()));
        settings.setTeacherCodePrefix(normalizeUppercase(request.teacherCodePrefix()));
        return toResponse(collegeSettingsRepository.save(settings));
    }

    public CollegeSettingsResponse saveNotifications(Long instituteId, NotificationsPayload request) {
        CollegeSettings settings = resolveSettings(validateInstitute(instituteId));
        settings.setEmailNotice(request.emailNotice());
        settings.setSmsAlerts(request.smsAlerts());
        settings.setHolidayNotice(request.holidayNotice());
        settings.setFeeReminders(request.feeReminders());
        settings.setAttendanceAlerts(request.attendanceAlerts());
        return toResponse(collegeSettingsRepository.save(settings));
    }

    public FeatureAccessResponse saveFeatureAccess(Long instituteId, FeatureAccessPayload request) {
        Institute institute = validateInstitute(instituteId);
        String featureKey = normalizeFeature(request.feature());
        Teacher teacher = request.teacherId() == null ? null : teacherRepository.findByInstituteIdAndId(instituteId, request.teacherId())
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + request.teacherId()));
        FeatureAccess access = teacher == null
                ? featureAccessRepository.findLegacyByInstituteIdAndFeatureKey(instituteId, featureKey)
                .orElseGet(() -> newFeatureAccess(institute, featureKey))
                : featureAccessRepository.findByInstituteIdAndFeatureKeyAndTeacherId(instituteId, featureKey, teacher.getId())
                .orElseGet(() -> {
                    FeatureAccess nextAccess = newFeatureAccess(institute, featureKey);
                    nextAccess.setTeacher(teacher);
                    return nextAccess;
                });

        access.setTeacher(teacher);
        access.setOperation(normalizeOperation(request.operation()));
        access.setEnabled(request.enabled());
        access.setPasswordHash("");
        return toFeatureResponse(featureAccessRepository.save(access));
    }

    public FeatureLoginResponse loginFeature(FeatureLoginRequest request) {
        throw new IllegalArgumentException("Legacy feature password login has been removed. Please login with the teacher account.");
    }

    public UnifiedLoginResponse loginUnified(UnifiedLoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        LoginIdentifier loginIdentifier = resolveLoginIdentifier(request);
        String password = request.password().trim();

        UserAccount account = authenticateOrBootstrapAdmin(loginIdentifier, password, clientIpResolver.resolve(servletRequest));
        AuthTokenPair tokens = authService.issueSession(account);
        authCookieSupport.setRefreshCookie(servletResponse, tokens.refreshToken());
        if ("ADMIN".equalsIgnoreCase(account.getRole())) {
            Institute adminInstitute = validateInstitute(account.getInstitute().getId());
            return new UnifiedLoginResponse(
                    adminInstitute.getId(),
                    adminInstitute.getUsername(),
                    adminInstitute.getInstitutionCode(),
                    adminInstitute.getInstituteName(),
                    adminInstitute.getType(),
                    "admin",
                    adminInstitute.getLogo(),
                    tokens.accessToken(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    account.isMustChangePassword(),
                    List.of()
            );
        }

        if ("TEACHER".equalsIgnoreCase(account.getRole()) && account.getTeacherId() != null) {
            Institute institute = validateInstitute(account.getInstitute().getId());
            Teacher teacher = teacherRepository.findByInstituteIdAndId(institute.getId(), account.getTeacherId())
                    .orElseThrow(() -> new IllegalArgumentException("Teacher account is not linked to an active teacher."));
            return new UnifiedLoginResponse(
                    institute.getId(),
                    institute.getUsername(),
                    institute.getInstitutionCode(),
                    institute.getInstituteName(),
                    institute.getType(),
                    "teacher",
                    institute.getLogo(),
                    tokens.accessToken(),
                    teacher.getId(),
                    teacher.getEmployeeId(),
                    buildTeacherName(teacher),
                    null,
                    null,
                    null,
                    account.isMustChangePassword(),
                    getTeacherFeatureAccess(institute.getId(), teacher.getId())
            );
        }

        if ("STUDENT".equalsIgnoreCase(account.getRole()) && account.getStudentId() != null) {
            Institute institute = validateInstitute(account.getInstitute().getId());
            Student student = studentRepository.findByInstituteIdAndId(institute.getId(), account.getStudentId())
                    .orElseThrow(() -> new IllegalArgumentException("Student account is not linked to an active student."));
            return new UnifiedLoginResponse(
                    institute.getId(),
                    institute.getUsername(),
                    institute.getInstitutionCode(),
                    institute.getInstituteName(),
                    institute.getType(),
                    "student",
                    institute.getLogo(),
                    tokens.accessToken(),
                    null,
                    null,
                    null,
                    student.getId(),
                    student.getEnrollmentNo(),
                    buildStudentName(student),
                    account.isMustChangePassword(),
                    List.of()
            );
        }

        throw new IllegalArgumentException("Invalid username, enrollment ID, teacher ID, or password.");
    }

    private UserAccount authenticateOrBootstrapAdmin(LoginIdentifier loginIdentifier, String password, String ipAddress) {
        try {
            if (loginIdentifier.institute() != null) {
                return authService.authenticateAccount(loginIdentifier.institute().getId(), loginIdentifier.accountIdentifier(), password, ipAddress);
            }
            return authService.authenticateLoginIdentifier(loginIdentifier.accountIdentifier(), password, ipAddress);
        } catch (IllegalArgumentException exception) {
            UserAccount legacyPortalAccount = migrateLegacyPortalAccount(loginIdentifier, password);
            if (legacyPortalAccount != null) {
                return authService.authenticateAccount(
                        legacyPortalAccount.getInstitute().getId(),
                        legacyPortalAccount.getNormalizedLoginIdentifier(),
                        password,
                        ipAddress
                );
            }
            Institute adminInstitute = instituteRepository.findByUsernameIgnoreCase(loginIdentifier.accountIdentifier()).orElse(null);
            if (adminInstitute != null && passwordEncoder.matches(password, adminInstitute.getPasswordHash())) {
                return authService.syncAdminAccount(adminInstitute);
            }
            throw exception;
        }
    }

    private UserAccount migrateLegacyPortalAccount(LoginIdentifier loginIdentifier, String password) {
        Teacher teacher = resolveLegacyTeacher(loginIdentifier);
        if (teacher != null && password.equals(buildLegacyTeacherPassword(teacher))) {
            return authService.upsertTeacherAccount(teacher, password, true);
        }

        Student student = resolveLegacyStudent(loginIdentifier);
        if (student != null && password.equals(buildLegacyStudentPassword(student))) {
            return authService.upsertStudentAccount(student, password, true);
        }

        return null;
    }

    private Teacher resolveLegacyTeacher(LoginIdentifier loginIdentifier) {
        if (loginIdentifier.institute() != null) {
            return teacherRepository
                    .findByInstituteIdAndEmployeeIdIgnoreCase(loginIdentifier.institute().getId(), loginIdentifier.accountIdentifier())
                    .orElse(null);
        }
        List<Teacher> matches = teacherRepository.findAllByEmployeeIdIgnoreCase(loginIdentifier.accountIdentifier());
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private Student resolveLegacyStudent(LoginIdentifier loginIdentifier) {
        if (loginIdentifier.institute() != null) {
            return studentRepository
                    .findByInstituteIdAndEnrollmentNoIgnoreCase(loginIdentifier.institute().getId(), loginIdentifier.accountIdentifier())
                    .orElse(null);
        }
        List<Student> matches = studentRepository.findAllByEnrollmentNoIgnoreCase(loginIdentifier.accountIdentifier());
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private String buildLegacyTeacherPassword(Teacher teacher) {
        return firstSixDigits(teacher.getMobileNumber()) + birthYear(teacher.getDob());
    }

    private String buildLegacyStudentPassword(Student student) {
        return firstSixDigits(student.getMobile()) + birthYear(student.getDob());
    }

    private String firstSixDigits(String value) {
        String digits = StringUtils.hasText(value) ? value.replaceAll("\\D", "") : "";
        return digits.length() >= 6 ? digits.substring(0, 6) : "";
    }

    private String birthYear(String value) {
        String trimmed = StringUtils.hasText(value) ? value.trim() : "";
        return trimmed.length() >= 4 && trimmed.substring(0, 4).matches("\\d{4}") ? trimmed.substring(0, 4) : "";
    }

    private LoginIdentifier resolveLoginIdentifier(UnifiedLoginRequest request) {
        String submittedIdentifier = request.username().trim();
        String institutionCode = StringUtils.hasText(request.institutionCode()) ? request.institutionCode().trim() : null;
        String accountIdentifier = submittedIdentifier;

        if (!StringUtils.hasText(institutionCode)) {
            int separatorIndex = firstSeparator(submittedIdentifier);
            if (separatorIndex > 0 && separatorIndex < submittedIdentifier.length() - 1) {
                institutionCode = submittedIdentifier.substring(0, separatorIndex).trim();
                accountIdentifier = submittedIdentifier.substring(separatorIndex + 1).trim();
            }
        }
        if (StringUtils.hasText(institutionCode) && "admin".equalsIgnoreCase(accountIdentifier)) {
            accountIdentifier = institutionCode;
        }

        Institute institute = resolveInstitute(institutionCode, submittedIdentifier);
        return new LoginIdentifier(institute, accountIdentifier);
    }

    private Institute resolveInstitute(String institutionCode, String submittedIdentifier) {
        if (StringUtils.hasText(institutionCode)) {
            return instituteRepository.findByUsernameIgnoreCase(institutionCode)
                    .orElseThrow(() -> new IllegalArgumentException("Invalid username, enrollment ID, teacher ID, or password."));
        }
        return null;
    }

    private int firstSeparator(String value) {
        int colon = value.indexOf(':');
        int slash = value.indexOf('/');
        if (colon < 0) return slash;
        if (slash < 0) return colon;
        return Math.min(colon, slash);
    }

    private record LoginIdentifier(Institute institute, String accountIdentifier) {
        private LoginIdentifier {
            if (!StringUtils.hasText(accountIdentifier)) {
                throw new IllegalArgumentException("Username, enrollment ID, or teacher ID is required.");
            }
        }
    }

    public List<FeatureAccessResponse> getTeacherFeatureAccess(Long instituteId, Long teacherId) {
        validateInstitute(instituteId);
        return featureAccessRepository.findAllByInstituteIdAndTeacherIdAndEnabledTrueOrderByFeatureKeyAsc(instituteId, teacherId)
                .stream()
                .map(this::toFeatureResponse)
                .toList();
    }

    public void resetSettings(Long instituteId) {
        validateInstitute(instituteId);
        collegeSettingsRepository.findByInstituteId(instituteId).ifPresent(collegeSettingsRepository::delete);
        featureAccessRepository.findAllByInstituteIdOrderByFeatureKeyAsc(instituteId).forEach(featureAccessRepository::delete);
    }

    private CollegeSettingsResponse toResponse(CollegeSettings settings) {
        return new CollegeSettingsResponse(
                settings.getInstitute().getInstituteName(),
                new PreferencesPayload(
                        defaultValue(settings.getAcademicYear(), "2026-2027"),
                        defaultValue(settings.getAcademicYearStartMonth(), "April"),
                        defaultValue(settings.getAcademicYearEndMonth(), "March"),
                        defaultValue(settings.getWorkingDays(), "Monday To Saturday"),
                        defaultValue(settings.getTimezone(), "Asia/Kolkata"),
                        defaultValue(settings.getLanguage(), "English"),
                        defaultValue(settings.getDateFormat(), "DD/MM/YYYY"),
                        defaultValue(settings.getCurrency(), "INR"),
                        defaultValue(settings.getTheme(), "Light"),
                        defaultValue(settings.getStudentCodePrefix(), "STU"),
                        defaultValue(settings.getTeacherCodePrefix(), "TCH")
                ),
                new NotificationsPayload(
                        settings.isEmailNotice(),
                        settings.isSmsAlerts(),
                        settings.isHolidayNotice(),
                        settings.isFeeReminders(),
                        settings.isAttendanceAlerts()
                ),
                featureAccessRepository.findAllByInstituteIdOrderByFeatureKeyAsc(settings.getInstitute().getId())
                        .stream()
                        .map(this::toFeatureResponse)
                        .toList(),
                settings.getUpdatedAt()
        );
    }

    private FeatureAccessResponse toFeatureResponse(FeatureAccess access) {
        Teacher teacher = access.getTeacher();
        return new FeatureAccessResponse(
                access.getFeatureKey(),
                teacher == null ? null : teacher.getId(),
                teacher == null ? null : buildTeacherName(teacher),
                teacher == null ? null : teacher.getEmployeeId(),
                defaultValue(access.getOperation(), "read"),
                access.isEnabled(),
                false,
                access.getUpdatedAt()
        );
    }

    private FeatureAccess newFeatureAccess(Institute institute, String featureKey) {
        FeatureAccess nextAccess = new FeatureAccess();
        nextAccess.setInstitute(institute);
        nextAccess.setFeatureKey(featureKey);
        nextAccess.setOperation("read");
        return nextAccess;
    }

    private CollegeSettings resolveSettings(Institute institute) {
        return collegeSettingsRepository.findByInstituteId(institute.getId())
                .orElseGet(() -> {
                    CollegeSettings settings = new CollegeSettings();
                    settings.setInstitute(institute);
                    settings.setAcademicYear("2026-2027");
                    settings.setAcademicYearStartMonth("April");
                    settings.setAcademicYearEndMonth("March");
                    settings.setWorkingDays("Monday To Saturday");
                    settings.setTimezone("Asia/Kolkata");
                    settings.setLanguage("English");
                    settings.setDateFormat("DD/MM/YYYY");
                    settings.setCurrency("INR");
                    settings.setTheme("Light");
                    settings.setStudentCodePrefix("STU");
                    settings.setTeacherCodePrefix("TCH");
                    return collegeSettingsRepository.save(settings);
                });
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private String normalizeFeature(String value) {
        if (!StringUtils.hasText(value)) {
            throw new FieldValidationException("Feature is required.", Map.of("feature", "Feature is required."));
        }
        return value.trim();
    }

    private String normalizeOperation(String value) {
        String operation = StringUtils.hasText(value) ? value.trim().toLowerCase() : "read";
        if (List.of("read", "read_write").contains(operation)) {
            return operation;
        }
        throw new FieldValidationException("Operation must be read or read_write.", Map.of("operation", "Operation must be read or read_write."));
    }

    private String buildTeacherName(Teacher teacher) {
        return String.join(" ",
                defaultValue(teacher.getFirstName(), "").trim(),
                defaultValue(teacher.getLastName(), "").trim()).trim();
    }

    private String buildStudentName(Student student) {
        return String.join(" ",
                defaultValue(student.getFirstName(), "").trim(),
                defaultValue(student.getLastName(), "").trim()).trim();
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeUppercase(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }
}
