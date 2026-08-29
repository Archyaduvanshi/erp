package com.erp.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import com.erp.backend.auth.dto.ForgotPasswordResponse;
import com.erp.backend.auth.dto.AuthMeResponse;
import com.erp.backend.auth.dto.AuthTokenPair;
import com.erp.backend.auth.entity.AuthSession;
import com.erp.backend.auth.entity.PasswordResetToken;
import com.erp.backend.auth.entity.UserAccount;
import com.erp.backend.auth.repository.AuthSessionRepository;
import com.erp.backend.auth.repository.PasswordResetTokenRepository;
import com.erp.backend.auth.repository.UserAccountRepository;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.settings.entity.FeatureAccess;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import com.erp.backend.settings.dto.FeatureAccessResponse;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    public static final String REFRESH_COOKIE = "erp_refresh";
    private final SecureRandom secureRandom = new SecureRandom();
    private static final int MAX_FAILED_LOGINS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final Duration RESET_TOKEN_DURATION = Duration.ofMinutes(30);
    private static final Duration REFRESH_REPLAY_GRACE = Duration.ofSeconds(10);

    private final UserAccountRepository userAccountRepository;
    private final AuthSessionRepository authSessionRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final InstituteRepository instituteRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final FeatureAccessRepository featureAccessRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RateLimiterService rateLimiterService;
    private final PasswordResetDeliveryService passwordResetDeliveryService;
    private final long refreshDays;
    private final boolean exposeResetToken;

    public AuthService(
            UserAccountRepository userAccountRepository,
            AuthSessionRepository authSessionRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            InstituteRepository instituteRepository,
            TeacherRepository teacherRepository,
            StudentRepository studentRepository,
            FeatureAccessRepository featureAccessRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            RateLimiterService rateLimiterService,
            PasswordResetDeliveryService passwordResetDeliveryService,
            @Value("${app.auth.refresh-token-days:14}") long refreshDays,
            @Value("${app.auth.expose-reset-token:false}") boolean exposeResetToken
    ) {
        this.userAccountRepository = userAccountRepository;
        this.authSessionRepository = authSessionRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.instituteRepository = instituteRepository;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
        this.featureAccessRepository = featureAccessRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.rateLimiterService = rateLimiterService;
        this.passwordResetDeliveryService = passwordResetDeliveryService;
        this.refreshDays = refreshDays;
        this.exposeResetToken = exposeResetToken;
    }

    @Transactional
    public UserAccount ensureAdminAccount(Institute institute) {
        return userAccountRepository.findByInstituteIdAndRole(institute.getId(), "ADMIN")
                .orElseGet(() -> saveAccount(institute, "ADMIN", institute.getUsername(), institute.getPasswordHash(), false, null, null));
    }

    @Transactional
    public UserAccount syncAdminAccount(Institute institute) {
        UserAccount account = userAccountRepository.findByInstituteIdAndRole(institute.getId(), "ADMIN")
                .orElseGet(UserAccount::new);
        populateAccount(account, institute, "ADMIN", institute.getUsername(), null, null);
        account.setPasswordHash(institute.getPasswordHash());
        account.setMustChangePassword(false);
        account.setPasswordChangedAt(LocalDateTime.now());
        return userAccountRepository.save(account);
    }

    @Transactional
    public UserAccount upsertTeacherAccount(Teacher teacher, String rawPassword, boolean mustChangePassword) {
        boolean isNewAccount = userAccountRepository.findByInstituteIdAndTeacherId(teacher.getInstitute().getId(), teacher.getId()).isEmpty();
        UserAccount account = userAccountRepository.findByInstituteIdAndTeacherId(teacher.getInstitute().getId(), teacher.getId())
                .orElseGet(UserAccount::new);
        populateAccount(account, teacher.getInstitute(), "TEACHER", teacher.getEmployeeId(), teacher.getId(), null);
        account.setStatus(activeTeacherStatus(teacher.getStatus()) ? "ACTIVE" : "INACTIVE");
        String selectedPassword = StringUtils.hasText(rawPassword) ? rawPassword.trim() : isNewAccount ? generateTemporaryPassword() : null;
        if (StringUtils.hasText(selectedPassword)) {
            account.setPasswordHash(passwordEncoder.encode(selectedPassword));
            account.setMustChangePassword(mustChangePassword);
            account.setPasswordChangedAt(LocalDateTime.now());
            account.setFailedLoginCount(0);
            account.setLockedUntil(null);
        }
        UserAccount savedAccount = userAccountRepository.save(account);
        if (!"ACTIVE".equalsIgnoreCase(savedAccount.getStatus())) {
            revokeAll(savedAccount.getId());
        }
        return savedAccount;
    }

    @Transactional
    public UserAccount upsertStudentAccount(Student student, String rawPassword, boolean mustChangePassword) {
        boolean isNewAccount = userAccountRepository.findByInstituteIdAndStudentId(student.getInstitute().getId(), student.getId()).isEmpty();
        UserAccount account = userAccountRepository.findByInstituteIdAndStudentId(student.getInstitute().getId(), student.getId())
                .orElseGet(UserAccount::new);
        populateAccount(account, student.getInstitute(), "STUDENT", student.getEnrollmentNo(), null, student.getId());
        account.setStatus(activeStudentStatus(student.getStatus()) ? "ACTIVE" : "INACTIVE");
        String selectedPassword = StringUtils.hasText(rawPassword) ? rawPassword.trim() : isNewAccount ? generateTemporaryPassword() : null;
        if (StringUtils.hasText(selectedPassword)) {
            account.setPasswordHash(passwordEncoder.encode(selectedPassword));
            account.setMustChangePassword(mustChangePassword);
            account.setPasswordChangedAt(LocalDateTime.now());
            account.setFailedLoginCount(0);
            account.setLockedUntil(null);
        }
        UserAccount savedAccount = userAccountRepository.save(account);
        if (!"ACTIVE".equalsIgnoreCase(savedAccount.getStatus())) {
            revokeAll(savedAccount.getId());
        }
        return savedAccount;
    }

    @Transactional
    public UserAccount authenticateAccount(Long instituteId, String identifier, String rawPassword, String ipAddress) {
        rateLimiterService.check("login-ip", ipAddress, 30, Duration.ofMinutes(1));
        rateLimiterService.check("login-account", instituteId + ":" + normalizeIdentifier(identifier), 10, Duration.ofMinutes(5));
        UserAccount account = userAccountRepository
                .findByInstituteIdAndNormalizedLoginIdentifierForUpdate(instituteId, normalizeIdentifier(identifier))
                .orElseThrow(this::invalidCredentials);
        return verifyAccountPassword(account, rawPassword);
    }

    private UserAccount verifyAccountPassword(UserAccount account, String rawPassword) {
        LocalDateTime now = LocalDateTime.now();
        if (!"ACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw invalidCredentials();
        }
        if (account.getLockedUntil() != null && account.getLockedUntil().isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Account is temporarily locked. Please try again later.");
        }
        if (!passwordEncoder.matches(rawPassword, account.getPasswordHash())) {
            account.setFailedLoginCount(account.getFailedLoginCount() + 1);
            account.setLastFailedLoginAt(now);
            if (account.getFailedLoginCount() >= MAX_FAILED_LOGINS) {
                account.setLockedUntil(now.plus(LOCK_DURATION));
            }
            userAccountRepository.save(account);
            throw invalidCredentials();
        }
        account.setFailedLoginCount(0);
        account.setLastFailedLoginAt(null);
        account.setLockedUntil(null);
        if (isPortalRole(account.getRole())) {
            account.setMustChangePassword(false);
        }
        return userAccountRepository.save(account);
    }

    @Transactional
    public void changePassword(AuthPrincipal principal, String currentPassword, String newPassword, String confirmPassword) {
        validateNewPassword(newPassword, confirmPassword);
        UserAccount account = userAccountRepository.findByIdForUpdate(principal.accountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated account no longer exists."));
        if (!passwordEncoder.matches(currentPassword, account.getPasswordHash())) {
            throw new FieldValidationException("Current password is incorrect.", Map.of("currentPassword", "Current password is incorrect."));
        }
        account.setPasswordHash(passwordEncoder.encode(newPassword));
        account.setMustChangePassword(false);
        account.setPasswordChangedAt(LocalDateTime.now());
        account.setFailedLoginCount(0);
        account.setLockedUntil(null);
        userAccountRepository.save(account);
        revokeAll(account.getId());
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(String institutionCode, String identifier, String ipAddress) {
        rateLimiterService.check("forgot-password-ip", ipAddress, 10, Duration.ofMinutes(10));
        LoginIdentifier loginIdentifier = resolveLoginIdentifier(institutionCode, identifier);
        List<UserAccount> accounts = accountsForPasswordReset(loginIdentifier);
        String message = "If an account matches, a reset link has been prepared.";
        if (accounts.size() != 1) {
            return new ForgotPasswordResponse(message, null);
        }
        String token = randomToken();
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setAccount(accounts.get(0));
        resetToken.setTokenHash(hash(token));
        resetToken.setExpiresAt(LocalDateTime.now().plus(RESET_TOKEN_DURATION));
        passwordResetTokenRepository.save(resetToken);
        passwordResetDeliveryService.deliver(accounts.get(0), token);
        return new ForgotPasswordResponse(message, exposeResetToken ? token : null);
    }

    @Transactional
    public void resetPassword(String token, String newPassword, String confirmPassword) {
        validateNewPassword(newPassword, confirmPassword);
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(hash(token))
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token."));
        if (resetToken.getUsedAt() != null || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Invalid or expired reset token.");
        }
        UserAccount account = resetToken.getAccount();
        account.setPasswordHash(passwordEncoder.encode(newPassword));
        account.setMustChangePassword(false);
        account.setPasswordChangedAt(LocalDateTime.now());
        account.setFailedLoginCount(0);
        account.setLockedUntil(null);
        resetToken.setUsedAt(LocalDateTime.now());
        userAccountRepository.save(account);
        passwordResetTokenRepository.save(resetToken);
        revokeAll(account.getId());
    }

    @Transactional
    public AuthTokenPair issueSession(UserAccount account) {
        String refreshToken = randomToken();
        AuthSession session = new AuthSession();
        session.setAccount(account);
        session.setRefreshTokenHash(hash(refreshToken));
        session.setExpiresAt(LocalDateTime.now().plusDays(refreshDays));
        authSessionRepository.save(session);
        limitSessions(account.getId());
        return new AuthTokenPair(jwtTokenService.createAccessToken(toPrincipal(account)), refreshToken);
    }

    @Transactional
    public AuthTokenPair refresh(String refreshToken) {
        if (!StringUtils.hasText(refreshToken)) {
            throw new IllegalArgumentException("Invalid refresh session.");
        }
        LocalDateTime now = LocalDateTime.now();
        AuthSession oldSession = authSessionRepository.findByRefreshTokenHash(hash(refreshToken))
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh session."));
        if (oldSession.getRevokedAt() != null) {
            if (isRecentRefreshReplay(oldSession, now)) {
                return issueSession(oldSession.getAccount());
            }
            revokeAll(oldSession.getAccount().getId());
            throw new IllegalArgumentException("Invalid refresh session.");
        }
        if (oldSession.getExpiresAt().isBefore(now)) {
            revokeAll(oldSession.getAccount().getId());
            throw new IllegalArgumentException("Invalid refresh session.");
        }
        if (!"ACTIVE".equalsIgnoreCase(oldSession.getAccount().getStatus())) {
            revokeAll(oldSession.getAccount().getId());
            throw new IllegalArgumentException("Invalid refresh session.");
        }
        oldSession.setRevokedAt(now);
        oldSession.setLastUsedAt(now);
        AuthTokenPair next = issueSession(oldSession.getAccount());
        authSessionRepository.flush();
        authSessionRepository.findByRefreshTokenHash(hash(next.refreshToken()))
                .map(AuthSession::getId)
                .ifPresent(oldSession::setReplacedBySessionId);
        authSessionRepository.save(oldSession);
        return next;
    }

    private boolean isRecentRefreshReplay(AuthSession session, LocalDateTime now) {
        return session.getReplacedBySessionId() != null
                && session.getLastUsedAt() != null
                && !session.getLastUsedAt().plus(REFRESH_REPLAY_GRACE).isBefore(now);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (!StringUtils.hasText(refreshToken)) return;
        authSessionRepository.findByRefreshTokenHash(hash(refreshToken)).ifPresent(session -> {
            session.setRevokedAt(LocalDateTime.now());
            authSessionRepository.save(session);
        });
    }

    @Transactional
    public void revokeAll(Long accountId) {
        authSessionRepository.findAllByAccountIdAndRevokedAtIsNullOrderByCreatedAtAsc(accountId).forEach(session -> {
            session.setRevokedAt(LocalDateTime.now());
            authSessionRepository.save(session);
        });
    }

    public AuthMeResponse me(AuthPrincipal principal) {
        List<FeatureAccessResponse> permissions = "TEACHER".equals(principal.role()) && principal.teacherId() != null
                ? featureAccessRepository.findAllByInstituteIdAndTeacherIdAndEnabledTrueOrderByFeatureKeyAsc(principal.instituteId(), principal.teacherId())
                .stream()
                .map(this::toFeatureResponse)
                .toList()
                : List.of();
        String name = principal.username();
        if ("TEACHER".equals(principal.role()) && principal.teacherId() != null) {
            name = teacherRepository.findByInstituteIdAndId(principal.instituteId(), principal.teacherId())
                    .map(teacher -> StringUtils.hasText(teacher.getName()) ? teacher.getName() : teacher.getFirstName())
                    .orElse(name);
        }
        if ("STUDENT".equals(principal.role()) && principal.studentId() != null) {
            name = studentRepository.findByInstituteIdAndId(principal.instituteId(), principal.studentId())
                    .map(student -> StringUtils.hasText(student.getName()) ? student.getName() : student.getFirstName())
                    .orElse(name);
        }
        return new AuthMeResponse(
                principal.accountId(),
                principal.role(),
                principal.instituteId(),
                principal.teacherId(),
                principal.studentId(),
                principal.username(),
                name,
                principal.mustChangePassword(),
                permissions,
                null
        );
    }

    private FeatureAccessResponse toFeatureResponse(FeatureAccess access) {
        Teacher teacher = access.getTeacher();
        return new FeatureAccessResponse(
                access.getFeatureKey(),
                teacher == null ? null : teacher.getId(),
                teacher == null ? null : StringUtils.hasText(teacher.getName()) ? teacher.getName() : teacher.getFirstName(),
                teacher == null ? null : teacher.getEmployeeId(),
                StringUtils.hasText(access.getOperation()) ? access.getOperation() : "read",
                access.isEnabled(),
                teacher != null || StringUtils.hasText(access.getPasswordHash()),
                access.getUpdatedAt()
        );
    }

    public AuthPrincipal toPrincipal(UserAccount account) {
        return new AuthPrincipal(
                account.getId(),
                account.getInstitute().getId(),
                account.getRole(),
                account.getTeacherId(),
                account.getStudentId(),
                account.getNormalizedLoginIdentifier(),
                account.isMustChangePassword()
        );
    }

    private UserAccount saveAccount(Institute institute, String role, String identifier, String passwordHash, boolean mustChangePassword, Long teacherId, Long studentId) {
        UserAccount account = new UserAccount();
        populateAccount(account, institute, role, identifier, teacherId, studentId);
        account.setPasswordHash(passwordHash);
        account.setMustChangePassword(mustChangePassword);
        account.setPasswordChangedAt(LocalDateTime.now());
        return userAccountRepository.save(account);
    }

    private void populateAccount(UserAccount account, Institute institute, String role, String identifier, Long teacherId, Long studentId) {
        account.setInstitute(institute);
        account.setRole(role);
        account.setNormalizedLoginIdentifier(normalizeIdentifier(identifier));
        account.setTeacherId(teacherId);
        account.setStudentId(studentId);
        if (!StringUtils.hasText(account.getStatus())) {
            account.setStatus("ACTIVE");
        }
    }

    private void validateNewPassword(String newPassword, String confirmPassword) {
        if (!StringUtils.hasText(newPassword) || !newPassword.equals(confirmPassword)) {
            throw new FieldValidationException(
                    "New password and confirm password do not match.",
                    Map.of("confirmPassword", "New password and confirm password do not match.")
            );
        }
        if (newPassword.length() < 8 || !newPassword.matches(".*[a-z].*") || !newPassword.matches(".*[A-Z].*")
                || !newPassword.matches(".*\\d.*") || !newPassword.matches(".*[^A-Za-z0-9].*")) {
            throw new FieldValidationException(
                    "Password must be at least 8 characters with uppercase, lowercase, number, and symbol.",
                    Map.of("newPassword", "Password must be at least 8 characters with uppercase, lowercase, number, and symbol.")
            );
        }
    }

    private IllegalArgumentException invalidCredentials() {
        return new IllegalArgumentException("Invalid username, enrollment ID, teacher ID, or password.");
    }

    private boolean activeTeacherStatus(String status) {
        return !StringUtils.hasText(status) || "ACTIVE".equalsIgnoreCase(status);
    }

    private boolean activeStudentStatus(String status) {
        return !StringUtils.hasText(status) || "VERIFIED".equalsIgnoreCase(status) || "ACTIVE".equalsIgnoreCase(status);
    }

    private boolean isPortalRole(String role) {
        return "TEACHER".equalsIgnoreCase(role) || "STUDENT".equalsIgnoreCase(role);
    }

    private List<UserAccount> accountsForPasswordReset(LoginIdentifier loginIdentifier) {
        if (loginIdentifier.institute() != null) {
            return userAccountRepository
                    .findByInstituteIdAndNormalizedLoginIdentifier(loginIdentifier.institute().getId(), normalizeIdentifier(loginIdentifier.accountIdentifier()))
                    .stream()
                    .toList();
        }
        return List.of();
    }

    private LoginIdentifier resolveLoginIdentifier(String institutionCode, String identifier) {
        String accountIdentifier = identifier == null ? "" : identifier.trim();
        String selectedInstitutionCode = StringUtils.hasText(institutionCode) ? institutionCode.trim() : null;
        if (!StringUtils.hasText(selectedInstitutionCode)) {
            int separatorIndex = firstSeparator(accountIdentifier);
            if (separatorIndex > 0 && separatorIndex < accountIdentifier.length() - 1) {
                selectedInstitutionCode = accountIdentifier.substring(0, separatorIndex).trim();
                accountIdentifier = accountIdentifier.substring(separatorIndex + 1).trim();
            }
        }
        Institute institute = resolveInstitute(selectedInstitutionCode, identifier == null ? "" : identifier.trim());
        if (StringUtils.hasText(selectedInstitutionCode)) {
            institute = instituteRepository.findByUsernameIgnoreCase(selectedInstitutionCode).orElse(null);
        }
        return new LoginIdentifier(institute, accountIdentifier);
    }

    private Institute resolveInstitute(String institutionCode, String submittedIdentifier) {
        if (StringUtils.hasText(institutionCode)) {
            return instituteRepository.findByUsernameIgnoreCase(institutionCode).orElse(null);
        }
        String normalizedIdentifier = submittedIdentifier.trim().toLowerCase();
        return instituteRepository.findAll().stream()
                .filter(institute -> StringUtils.hasText(institute.getUsername()))
                .sorted(Comparator.comparingInt((Institute institute) -> institute.getUsername().length()).reversed())
                .filter(institute -> {
                    String code = institute.getUsername().trim().toLowerCase();
                    if (!normalizedIdentifier.startsWith(code)) {
                        return false;
                    }
                    String suffix = normalizedIdentifier.substring(code.length());
                    return suffix.startsWith("emp") || suffix.startsWith("stu");
                })
                .findFirst()
                .orElse(null);
    }

    private int firstSeparator(String value) {
        int colon = value.indexOf(':');
        int slash = value.indexOf('/');
        if (colon < 0) return slash;
        if (slash < 0) return colon;
        return Math.min(colon, slash);
    }

    private record LoginIdentifier(Institute institute, String accountIdentifier) {
    }

    private void limitSessions(Long accountId) {
        List<AuthSession> active = authSessionRepository.findAllByAccountIdAndRevokedAtIsNullOrderByCreatedAtAsc(accountId);
        while (active.size() > 8) {
            AuthSession oldest = active.remove(0);
            oldest.setRevokedAt(LocalDateTime.now());
            authSessionRepository.save(oldest);
        }
    }

    public static String normalizeIdentifier(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase() : "";
    }

    public String generateTemporaryPassword() {
        return randomToken().substring(0, 16) + "aA1!";
    }

    private String randomToken() {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Token is required.");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash token.", exception);
        }
    }
}
