package com.erp.backend.institute.controller;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.RateLimiterService;
import com.erp.backend.institute.dto.InstituteAuthResponse;
import com.erp.backend.institute.dto.InstituteLoginRequest;
import com.erp.backend.institute.dto.InstituteResponse;
import com.erp.backend.institute.dto.RegisterInstituteRequest;
import com.erp.backend.institute.dto.UpdateInstituteRequest;
import com.erp.backend.institute.service.InstituteService;
import com.erp.backend.settings.dto.ChangeAdminPasswordRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/institutes")
public class InstituteController {

    private final InstituteService instituteService;
    private final RateLimiterService rateLimiterService;
    private final ClientIpResolver clientIpResolver;

    public InstituteController(InstituteService instituteService, RateLimiterService rateLimiterService, ClientIpResolver clientIpResolver) {
        this.instituteService = instituteService;
        this.rateLimiterService = rateLimiterService;
        this.clientIpResolver = clientIpResolver;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public InstituteAuthResponse registerInstitute(@Valid @RequestBody RegisterInstituteRequest request, HttpServletRequest servletRequest, HttpServletResponse response) {
        rateLimiterService.check("institute-registration", clientIpResolver.resolve(servletRequest), 5, java.time.Duration.ofHours(1));
        return instituteService.registerInstitute(request, response);
    }

    @PostMapping("/login")
    public InstituteAuthResponse loginInstitute(@Valid @RequestBody InstituteLoginRequest request, HttpServletRequest servletRequest, HttpServletResponse response) {
        return instituteService.loginInstitute(request, servletRequest, response);
    }

    @GetMapping("/{id}")
    public InstituteResponse getInstituteById(@PathVariable Long id, @AuthenticationPrincipal AuthPrincipal principal) {
        ensureSameInstitute(id, principal);
        return instituteService.getInstituteById(id);
    }

    @GetMapping("/me")
    public InstituteResponse getMyInstitute(@AuthenticationPrincipal AuthPrincipal principal) {
        return instituteService.getInstituteById(principal.instituteId());
    }

    @PutMapping("/{id}")
    public InstituteResponse updateInstitute(@PathVariable Long id, @Valid @RequestBody UpdateInstituteRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        ensureSameInstitute(id, principal);
        return instituteService.updateInstitute(id, request);
    }

    @PutMapping("/me")
    public InstituteResponse updateMyInstitute(@Valid @RequestBody UpdateInstituteRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return instituteService.updateInstitute(principal.instituteId(), request);
    }

    @PostMapping("/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@PathVariable Long id, @Valid @RequestBody ChangeAdminPasswordRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        ensureSameInstitute(id, principal);
        instituteService.changePassword(id, request);
    }

    @PostMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changeMyPassword(@Valid @RequestBody ChangeAdminPasswordRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        instituteService.changePassword(principal.instituteId(), request);
    }

    private void ensureSameInstitute(Long instituteId, AuthPrincipal principal) {
        if (principal == null || !instituteId.equals(principal.instituteId())) {
            throw new AccessDeniedException("You can only access your own institute.");
        }
    }
}
