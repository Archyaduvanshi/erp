package com.erp.backend.institute.service;

import java.util.LinkedHashMap;
import java.util.Map;

import com.erp.backend.auth.AuthCookieSupport;
import com.erp.backend.auth.ClientIpResolver;
import com.erp.backend.auth.AuthService;
import com.erp.backend.auth.dto.AuthTokenPair;
import com.erp.backend.auth.entity.UserAccount;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.dto.InstituteAuthResponse;
import com.erp.backend.institute.dto.InstituteLoginRequest;
import com.erp.backend.institute.dto.InstituteResponse;
import com.erp.backend.institute.dto.RegisterInstituteRequest;
import com.erp.backend.institute.dto.UpdateInstituteRequest;
import com.erp.backend.settings.dto.ChangeAdminPasswordRequest;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.platform.service.PlatformProvisioningService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class InstituteService {
    private static final int MAX_REGISTRATION_ATTEMPTS = 10_000;

    private final InstituteRepository instituteRepository;
    private final InstituteMapper instituteMapper;
    private final InstitutionCodeService institutionCodeService;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final AuthCookieSupport authCookieSupport;
    private final ClientIpResolver clientIpResolver;
    private final PlatformProvisioningService platformProvisioningService;

    public InstituteService(
            InstituteRepository instituteRepository,
            InstituteMapper instituteMapper,
            InstitutionCodeService institutionCodeService,
            PasswordEncoder passwordEncoder,
            AuthService authService,
            AuthCookieSupport authCookieSupport,
            ClientIpResolver clientIpResolver,
            PlatformProvisioningService platformProvisioningService
    ) {
        this.instituteRepository = instituteRepository;
        this.instituteMapper = instituteMapper;
        this.institutionCodeService = institutionCodeService;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.authCookieSupport = authCookieSupport;
        this.clientIpResolver = clientIpResolver;
        this.platformProvisioningService = platformProvisioningService;
    }

    @Transactional
    public InstituteAuthResponse registerInstitute(RegisterInstituteRequest request, HttpServletResponse servletResponse) {
        platformProvisioningService.assertRegistrationEnabled();
        validateRegistrationRequest(request);
        validateUniqueness(request);

        Institute savedInstitute = saveWithInstitutionCodeRetry(request);
        platformProvisioningService.provisionTrial(savedInstitute.getId());
        UserAccount account = authService.syncAdminAccount(savedInstitute);
        AuthTokenPair tokens = authService.issueSession(account);
        authCookieSupport.setRefreshCookie(servletResponse, tokens.refreshToken());
        InstituteAuthResponse response = instituteMapper.toAuthResponse(savedInstitute);
        response.setAccessToken(tokens.accessToken());
        return response;
    }

    @Transactional
    public InstituteResponse createInstituteFromPlatform(RegisterInstituteRequest request) {
        validateRegistrationRequest(request);
        validateUniqueness(request);
        Institute savedInstitute = saveWithInstitutionCodeRetry(request);
        platformProvisioningService.provisionTrial(savedInstitute.getId());
        authService.syncAdminAccount(savedInstitute);
        return instituteMapper.toResponse(savedInstitute);
    }

    public InstituteAuthResponse loginInstitute(InstituteLoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        UserAccount account = authService.authenticateLoginIdentifier(
                request.getUsername(),
                request.getPassword(),
                clientIpResolver.resolve(servletRequest)
        );
        if (!"ADMIN".equalsIgnoreCase(account.getRole())) {
            throw new IllegalArgumentException("Invalid institution username or password.");
        }

        AuthTokenPair tokens = authService.issueSession(account);
        authCookieSupport.setRefreshCookie(servletResponse, tokens.refreshToken());
        InstituteAuthResponse response = instituteMapper.toAuthResponse(account.getInstitute());
        response.setAccessToken(tokens.accessToken());
        return response;
    }

    public InstituteResponse getInstituteById(Long id) {
        Institute institute = instituteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + id));
        return instituteMapper.toResponse(institute);
    }

    public InstituteResponse updateInstitute(Long id, UpdateInstituteRequest request) {
        Institute institute = instituteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + id));

        institute.setInstituteName(normalizeUppercase(request.getInstituteName()));
        institute.setType(normalizeUppercase(request.getType()));
        institute.setAffiliationNo(normalizeUppercase(request.getAffiliationNo()));
        institute.setAffiliatedFrom(normalizeUppercase(request.getAffiliatedFrom()));
        institute.setContact(onlyDigits(request.getContact()));
        institute.setEmail(request.getEmail().trim().toLowerCase());
        institute.setWebsite(normalizeOptional(request.getWebsite()));
        institute.setAddress(normalizeUppercase(request.getAddress()));
        institute.setState(normalizeUppercase(request.getState()));
        institute.setCity(normalizeUppercase(request.getCity()));
        institute.setPincode(onlyDigits(request.getPincode()));

        return instituteMapper.toResponse(instituteRepository.save(institute));
    }

    public void changePassword(Long id, ChangeAdminPasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new FieldValidationException(
                    "New password and confirm password do not match.",
                    Map.of("confirmPassword", "New password and confirm password do not match.")
            );
        }

        Institute institute = instituteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + id));
        if (!passwordEncoder.matches(request.currentPassword(), institute.getPasswordHash())) {
            throw new FieldValidationException(
                    "Current password is incorrect.",
                    Map.of("currentPassword", "Current password is incorrect.")
            );
        }

        institute.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        authService.syncAdminAccount(instituteRepository.save(institute));
    }

    private void validateRegistrationRequest(RegisterInstituteRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new FieldValidationException(
                    "Password and confirm password do not match.",
                    Map.of("confirmPassword", "Password and confirm password do not match.")
            );
        }
    }

    private void validateUniqueness(RegisterInstituteRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        if (instituteRepository.existsByEmailIgnoreCase(request.getEmail().trim())) {
            fieldErrors.put("email", "Email is already registered.");
        }
        if (instituteRepository.existsByAffiliationNoIgnoreCase(request.getAffiliationNo().trim())) {
            fieldErrors.put("affiliationNo", "Affiliation number is already registered.");
        }

        if (!fieldErrors.isEmpty()) {
            throw new FieldValidationException("Please fix the highlighted fields.", fieldErrors);
        }
    }

    private Institute saveWithInstitutionCodeRetry(RegisterInstituteRequest request) {
        String baseCode = institutionCodeService.generateBaseCode(request.getInstituteName());

        for (int attempt = 0; attempt < MAX_REGISTRATION_ATTEMPTS; attempt++) {
            String institutionCode = institutionCodeService.withSuffix(baseCode, attempt);
            if (instituteRepository.existsByUsernameIgnoreCase(institutionCode)) {
                continue;
            }
            try {
                return instituteRepository.saveAndFlush(newInstitute(request, institutionCode));
            } catch (DataIntegrityViolationException exception) {
                if (attempt == MAX_REGISTRATION_ATTEMPTS - 1) {
                    throw exception;
                }
            }
        }

        throw new IllegalStateException("Unable to generate a unique institution code. Please try again.");
    }

    private Institute newInstitute(RegisterInstituteRequest request, String institutionCode) {
        Institute institute = new Institute();
        institute.setInstituteName(normalizeUppercase(request.getInstituteName()));
        institute.setType(normalizeUppercase(request.getType()));
        institute.setInstitutionCode(institutionCode);
        institute.setAffiliationNo(normalizeUppercase(request.getAffiliationNo()));
        institute.setAffiliatedFrom(normalizeUppercase(request.getAffiliatedFrom()));
        institute.setContact(onlyDigits(request.getContact()));
        institute.setEmail(request.getEmail().trim().toLowerCase());
        institute.setWebsite(normalizeOptional(request.getWebsite()));
        institute.setAddress(normalizeUppercase(request.getAddress()));
        institute.setState(normalizeUppercase(request.getState()));
        institute.setCity(normalizeUppercase(request.getCity()));
        institute.setPincode(onlyDigits(request.getPincode()));
        institute.setLogo(normalizeOptional(request.getLogo()));
        institute.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        return institute;
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeUppercase(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase() : null;
    }

    private String onlyDigits(String value) {
        return StringUtils.hasText(value) ? value.replaceAll("\\D", "") : null;
    }
}
