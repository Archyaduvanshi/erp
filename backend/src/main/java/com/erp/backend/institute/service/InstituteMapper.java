package com.erp.backend.institute.service;

import com.erp.backend.institute.dto.InstituteAuthResponse;
import com.erp.backend.institute.dto.InstituteResponse;
import com.erp.backend.institute.entity.Institute;
import org.springframework.stereotype.Component;

@Component
public class InstituteMapper {

    public InstituteResponse toResponse(Institute institute) {
        InstituteResponse response = new InstituteResponse();
        response.setId(institute.getId());
        response.setInstituteName(institute.getInstituteName());
        response.setType(institute.getType());
        response.setUsername(institute.getUsername());
        response.setInstitutionCode(institute.getInstitutionCode());
        response.setAffiliationNo(institute.getAffiliationNo());
        response.setAffiliatedFrom(institute.getAffiliatedFrom());
        response.setContact(institute.getContact());
        response.setEmail(institute.getEmail());
        response.setWebsite(institute.getWebsite());
        response.setAddress(institute.getAddress());
        response.setState(institute.getState());
        response.setCity(institute.getCity());
        response.setPincode(institute.getPincode());
        response.setLogo(institute.getLogo());
        response.setRegisteredDate(institute.getRegisteredDate());
        return response;
    }

    public InstituteAuthResponse toAuthResponse(Institute institute) {
        InstituteAuthResponse response = new InstituteAuthResponse();
        response.setId(institute.getId());
        response.setUsername(institute.getUsername());
        response.setInstitutionCode(institute.getInstitutionCode());
        response.setInstituteName(institute.getInstituteName());
        response.setType(institute.getType());
        response.setRole("admin");
        response.setLogo(institute.getLogo());
        return response;
    }
}
