package com.erp.backend.institute.service;

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
        institute.setInstituteName(request.getInstituteName().trim());
        institute.setType(request.getType().trim());
        institute.setUsername(request.getUsername().trim());
        institute.setAffiliationNo(request.getAffiliationNo().trim());
        institute.setAffiliatedFrom(request.getAffiliatedFrom().trim());
        institute.setContact(request.getContact().trim());
        institute.setEmail(request.getEmail().trim().toLowerCase());
        institute.setWebsite(normalizeOptional(request.getWebsite()));
        institute.setAddress(request.getAddress().trim());
        institute.setState(request.getState().trim());
        institute.setCity(request.getCity().trim());
        institute.setPincode(request.getPincode().trim());
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
            throw new IllegalArgumentException("Password and confirm password do not match.");
        }
    }

    private void validateUniqueness(RegisterInstituteRequest request) {
        if (instituteRepository.existsByUsernameIgnoreCase(request.getUsername().trim())) {
            throw new IllegalArgumentException("Username already taken. Please choose another.");
        }
        if (instituteRepository.existsByEmailIgnoreCase(request.getEmail().trim())) {
            throw new IllegalArgumentException("Email is already registered.");
        }
        if (instituteRepository.existsByAffiliationNoIgnoreCase(request.getAffiliationNo().trim())) {
            throw new IllegalArgumentException("Affiliation number is already registered.");
        }
    }

    private String normalizeOptional(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
