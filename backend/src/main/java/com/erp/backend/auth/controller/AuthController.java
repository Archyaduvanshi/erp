package com.erp.backend.auth.controller;

import com.erp.backend.auth.AuthCookieSupport;
import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.auth.AuthService;
import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.JwtTokenService;
import com.erp.backend.auth.OriginValidator;
import com.erp.backend.auth.dto.AuthMeResponse;
import com.erp.backend.auth.dto.AuthTokenPair;
import com.erp.backend.auth.dto.ChangePasswordRequest;
import com.erp.backend.auth.dto.ForgotPasswordRequest;
import com.erp.backend.auth.dto.ForgotPasswordResponse;
import com.erp.backend.auth.dto.ResetPasswordRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final AuthCookieSupport authCookieSupport;
    private final JwtTokenService jwtTokenService;
    private final ClientIpResolver clientIpResolver;
    private final OriginValidator originValidator;

    public AuthController(
            AuthService authService,
            AuthCookieSupport authCookieSupport,
            JwtTokenService jwtTokenService,
            ClientIpResolver clientIpResolver,
            OriginValidator originValidator
    ) {
        this.authService = authService;
        this.authCookieSupport = authCookieSupport;
        this.jwtTokenService = jwtTokenService;
        this.clientIpResolver = clientIpResolver;
        this.originValidator = originValidator;
    }

    @GetMapping("/me")
    public AuthMeResponse me(@AuthenticationPrincipal AuthPrincipal principal) {
        return authService.me(principal);
    }

    @PostMapping("/refresh")
    public AuthMeResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        originValidator.validateBrowserOrigin(request);
        AuthTokenPair tokens;
        try {
            tokens = authService.refresh(authCookieSupport.readRefreshCookie(request));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh session.");
        }
        authCookieSupport.setRefreshCookie(response, tokens.refreshToken());
        response.setHeader("X-Access-Token", tokens.accessToken());
        AuthMeResponse session = authService.me(jwtTokenService.parse(tokens.accessToken()));
        return new AuthMeResponse(
                session.accountId(),
                session.role(),
                session.instituteId(),
                session.teacherId(),
                session.studentId(),
                session.username(),
                session.name(),
                session.mustChangePassword(),
                session.permissions(),
                tokens.accessToken()
        );
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        originValidator.validateBrowserOrigin(request);
        authService.logout(authCookieSupport.readRefreshCookie(request));
        authCookieSupport.clearRefreshCookie(response);
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(@AuthenticationPrincipal AuthPrincipal principal, HttpServletRequest request, HttpServletResponse response) {
        originValidator.validateBrowserOrigin(request);
        authService.revokeAll(principal.accountId());
        authCookieSupport.clearRefreshCookie(response);
    }

    @PostMapping("/password/change")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody ChangePasswordRequest request, HttpServletResponse response) {
        authService.changePassword(principal, request.currentPassword(), request.newPassword(), request.confirmPassword());
        authCookieSupport.clearRefreshCookie(response);
    }

    @PostMapping("/password/change/otp")
    public java.util.Map<String, Object> sendPasswordChangeOtp(@AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request, HttpServletRequest servletRequest) {
        return authService.sendPasswordChangeOtp(principal, request.currentPassword(), request.newPassword(),
                request.confirmPassword(), clientIpResolver.resolve(servletRequest));
    }

    @PostMapping("/password/forgot")
    public ForgotPasswordResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest servletRequest) {
        return authService.forgotPassword(request.institutionCode(), request.username(), clientIpResolver.resolve(servletRequest));
    }

    @PostMapping("/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.newPassword(), request.confirmPassword());
    }

}
