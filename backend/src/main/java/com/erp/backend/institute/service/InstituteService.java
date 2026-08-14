package com.erp.backend.institute.service;

import java.util.LinkedHashMap;
import java.util.Map;

import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.dto.InstituteAuthResponse;
import com.erp.backend.institute.dto.InstituteLoginRequest;
import com.erp.backend.institute.dto.InstituteResponse;
import com.erp.backend.institute.dto.RegisterInstituteRequest;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class InstituteService {

    private final InstituteRepository instituteRepository;
    private final InstituteMapper instituteMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public InstituteService(InstituteRepository instituteRepository, InstituteMapper instituteMapper) {
        this.instituteRepository = instituteRepository;
        this.instituteMapper = instituteMapper;
    }

    public InstituteAuthResponse registerInstitute(RegisterInstituteRequest request) {
        validateRegistrationRequest(request);
        validateUniqueness(request);

        Institute institute = new Institute();
        institute.setInstituteName(normalizeUppercase(request.getInstituteName()));
        institute.setType(normalizeUppercase(request.getType()));
        institute.setUsername(request.getUsername().trim());
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

        Institute savedInstitute = instituteRepository.save(institute);
        return instituteMapper.toAuthResponse(savedInstitute);
    }

    public InstituteAuthResponse loginInstitute(InstituteLoginRequest request) {
        Institute institute = instituteRepository.findByUsernameIgnoreCase(request.getUsername().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid institution username or password."));

        if (!passwordEncoder.matches(request.getPassword(), institute.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid institution username or password.");
        }

        return instituteMapper.toAuthResponse(institute);
    }

    public InstituteResponse getInstituteById(Long id) {
        Institute institute = instituteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + id));
        return instituteMapper.toResponse(institute);
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

        if (instituteRepository.existsByUsernameIgnoreCase(request.getUsername().trim())) {
            fieldErrors.put("username", "Username already taken. Please choose another.");
        }
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
