package com.erp.backend.institute.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class UpdateInstituteRequest {

    @NotBlank(message = "Institute name is required")
    private String instituteName;

    @NotBlank(message = "Institute type is required")
    private String type;

    private String affiliationNo;
    private String affiliatedFrom;

    @NotBlank(message = "Contact number is required")
    @Pattern(regexp = "\\d{10}", message = "Contact number must be exactly 10 digits")
    private String contact;

    @NotBlank(message = "Official email is required")
    @Email(message = "Official email must be valid")
    private String email;

    private String website;

    @NotBlank(message = "Address is required")
    private String address;

    @NotBlank(message = "State is required")
    private String state;

    @NotBlank(message = "City is required")
    private String city;

    @NotBlank(message = "Pincode is required")
    @Pattern(regexp = "\\d{6}", message = "Pincode must be exactly 6 digits")
    private String pincode;

    public String getInstituteName() {
        return instituteName;
    }

    public void setInstituteName(String instituteName) {
        this.instituteName = instituteName;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getAffiliationNo() {
        return affiliationNo;
    }

    public void setAffiliationNo(String affiliationNo) {
        this.affiliationNo = affiliationNo;
    }

    public String getAffiliatedFrom() {
        return affiliatedFrom;
    }

    public void setAffiliatedFrom(String affiliatedFrom) {
        this.affiliatedFrom = affiliatedFrom;
    }

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getWebsite() {
        return website;
    }

    public void setWebsite(String website) {
        this.website = website;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getPincode() {
        return pincode;
    }

    public void setPincode(String pincode) {
        this.pincode = pincode;
    }
}
