package com.erp.backend.platform.auth;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.OriginValidator;
import com.erp.backend.platform.auth.dto.PlatformAuthDtos.LoginRequest;
import com.erp.backend.platform.auth.dto.PlatformAuthDtos.SessionResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/auth")
public class PlatformAuthController {
    private final PlatformAuthService service;
    private final PlatformAuthCookieSupport cookies;
    private final ClientIpResolver clientIpResolver;
    private final OriginValidator originValidator;

    public PlatformAuthController(PlatformAuthService service, PlatformAuthCookieSupport cookies,
                                  ClientIpResolver clientIpResolver, OriginValidator originValidator) {
        this.service = service;
        this.cookies = cookies;
        this.clientIpResolver = clientIpResolver;
        this.originValidator = originValidator;
    }

    @PostMapping("/login")
    public SessionResponse login(@Valid @RequestBody LoginRequest payload, HttpServletRequest request, HttpServletResponse response) {
        PlatformAuthService.LoginResult result = service.login(payload.username(), payload.password(), clientIpResolver.resolve(request), request);
        cookies.set(response, result.refreshToken());
        return result.session();
    }

    @PostMapping("/refresh")
    public SessionResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        originValidator.validateBrowserOrigin(request);
        PlatformAuthService.LoginResult result = service.refresh(cookies.read(request));
        cookies.set(response, result.refreshToken());
        response.setHeader("X-Access-Token", result.session().accessToken());
        return result.session();
    }

    @GetMapping("/me")
    public SessionResponse me(@AuthenticationPrincipal AuthPrincipal principal) { return service.me(principal); }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        originValidator.validateBrowserOrigin(request);
        service.logout(cookies.read(request));
        cookies.clear(response);
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(@AuthenticationPrincipal AuthPrincipal principal, HttpServletRequest request, HttpServletResponse response) {
        originValidator.validateBrowserOrigin(request);
        service.logoutAll(principal.accountId());
        cookies.clear(response);
    }
}
