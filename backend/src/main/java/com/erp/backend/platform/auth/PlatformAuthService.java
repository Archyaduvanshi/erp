package com.erp.backend.platform.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.auth.AuthService;
import com.erp.backend.auth.JwtTokenService;
import com.erp.backend.auth.RateLimiterService;
import com.erp.backend.platform.auth.dto.PlatformAuthDtos.SessionResponse;
import com.erp.backend.platform.auth.dto.PlatformAuthDtos.TokenPair;
import com.erp.backend.platform.auth.entity.PlatformAuthSession;
import com.erp.backend.platform.auth.entity.PlatformUser;
import com.erp.backend.platform.auth.repository.PlatformAuthSessionRepository;
import com.erp.backend.platform.auth.repository.PlatformUserRepository;
import com.erp.backend.platform.service.PlatformAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlatformAuthService {
    private static final int MAX_FAILED_LOGINS = 5;
    private final SecureRandom random = new SecureRandom();
    private final PlatformUserRepository userRepository;
    private final PlatformAuthSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RateLimiterService rateLimiterService;
    private final PlatformAuditService auditService;
    private final long refreshDays;

    public PlatformAuthService(
            PlatformUserRepository userRepository,
            PlatformAuthSessionRepository sessionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            RateLimiterService rateLimiterService,
            PlatformAuditService auditService,
            @Value("${app.platform.auth.refresh-token-days:7}") long refreshDays
    ) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.rateLimiterService = rateLimiterService;
        this.auditService = auditService;
        this.refreshDays = refreshDays;
    }

    @Transactional
    public LoginResult login(String username, String password, String ipAddress, HttpServletRequest request) {
        String normalized = normalize(username);
        rateLimiterService.check("platform-login-ip", ipAddress, 20, Duration.ofMinutes(1));
        rateLimiterService.check("platform-login-account", normalized, 8, Duration.ofMinutes(5));
        PlatformUser user = userRepository.findForUpdateByNormalizedUsername(normalized)
                .orElseThrow(this::invalidCredentials);
        LocalDateTime now = LocalDateTime.now();
        if (!"ACTIVE".equals(user.getStatus()) || (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now))) {
            throw invalidCredentials();
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            user.setFailedLoginCount(user.getFailedLoginCount() + 1);
            user.setLastFailedLoginAt(now);
            if (user.getFailedLoginCount() >= MAX_FAILED_LOGINS) user.setLockedUntil(now.plusMinutes(15));
            userRepository.save(user);
            throw invalidCredentials();
        }
        user.setFailedLoginCount(0);
        user.setLastFailedLoginAt(null);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        userRepository.save(user);
        TokenPair tokens = issue(user);
        auditService.record(user.getId(), "PLATFORM_LOGIN", "PLATFORM_USER", String.valueOf(user.getId()), null, null, null,
                "Successful platform login", ipAddress, request.getHeader("User-Agent"));
        return new LoginResult(toResponse(user, tokens.accessToken()), tokens.refreshToken());
    }

    @Transactional
    public LoginResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) throw invalidRefresh();
        PlatformAuthSession old = sessionRepository.findByRefreshTokenHash(AuthService.hash(rawRefreshToken))
                .orElseThrow(this::invalidRefresh);
        LocalDateTime now = LocalDateTime.now();
        if (old.getRevokedAt() != null || old.getExpiresAt().isBefore(now)
                || !"ACTIVE".equals(old.getPlatformUser().getStatus())) throw invalidRefresh();
        old.setRevokedAt(now);
        old.setLastUsedAt(now);
        sessionRepository.save(old);
        TokenPair tokens = issue(old.getPlatformUser());
        return new LoginResult(toResponse(old.getPlatformUser(), tokens.accessToken()), tokens.refreshToken());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        sessionRepository.findByRefreshTokenHash(AuthService.hash(rawRefreshToken)).ifPresent(session -> {
            session.setRevokedAt(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    @Transactional
    public void logoutAll(Long userId) {
        sessionRepository.findAllByPlatformUserIdAndRevokedAtIsNullOrderByCreatedAtAsc(userId).forEach(session -> {
            session.setRevokedAt(LocalDateTime.now());
            sessionRepository.save(session);
        });
    }

    public SessionResponse me(AuthPrincipal principal) {
        PlatformUser user = userRepository.findById(principal.accountId()).orElseThrow(this::invalidRefresh);
        if (!"SUPER_ADMIN".equals(principal.role()) || !"ACTIVE".equals(user.getStatus())) throw invalidRefresh();
        return toResponse(user, null);
    }

    private TokenPair issue(PlatformUser user) {
        String refresh = randomToken();
        PlatformAuthSession session = new PlatformAuthSession();
        session.setPlatformUser(user);
        session.setRefreshTokenHash(AuthService.hash(refresh));
        session.setExpiresAt(LocalDateTime.now().plusDays(refreshDays));
        sessionRepository.save(session);
        List<PlatformAuthSession> active = sessionRepository.findAllByPlatformUserIdAndRevokedAtIsNullOrderByCreatedAtAsc(user.getId());
        while (active.size() > 5) {
            PlatformAuthSession oldest = active.remove(0);
            oldest.setRevokedAt(LocalDateTime.now());
            sessionRepository.save(oldest);
        }
        AuthPrincipal principal = new AuthPrincipal(user.getId(), null, "SUPER_ADMIN", null, null, user.getNormalizedUsername(), false);
        return new TokenPair(jwtTokenService.createAccessToken(principal), refresh);
    }

    private SessionResponse toResponse(PlatformUser user, String accessToken) {
        return new SessionResponse(user.getId(), user.getNormalizedUsername(), user.getDisplayName(), user.getRole(), accessToken);
    }

    private String randomToken() {
        byte[] bytes = new byte[48];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String normalize(String value) { return value == null ? "" : value.trim().toLowerCase(); }
    private RuntimeException invalidCredentials() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials."); }
    private RuntimeException invalidRefresh() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired platform session."); }

    public record LoginResult(SessionResponse session, String refreshToken) {}
}
