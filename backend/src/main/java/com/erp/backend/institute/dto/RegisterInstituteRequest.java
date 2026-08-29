package com.erp.backend.institute.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class RegisterInstituteRequest {

    @NotBlank(message = "Institute name is required")
    private String instituteName;

    @NotBlank(message = "Institute type is required")
    private String type;

    @NotBlank(message = "Username is required")
    @Size(min = 4, max = 120, message = "Institution code must be between 4 and 120 characters")
    @Pattern(regexp = "^[A-Za-z0-9]+$", message = "Username can contain only small letters, capital letters, and numbers")
    private String username;

    @NotBlank(message = "Affiliation number is required")
    private String affiliationNo;

    @NotBlank(message = "Affiliated from is required")
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
    @Pattern(regexp = "\\d{6}", message = "Pincode must be 6 digits")
    private String pincode;

    @NotBlank(message = "Institution logo is required")
    private String logo;

    @NotBlank(message = "Password is required")
    @Pattern(
            regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$",
            message = "Password must be at least 8 characters with 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol"
    )
    private String password;

    @NotBlank(message = "Confirm password is required")
    private String confirmPassword;

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

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
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

    public String getLogo() {
        return logo;
    }

    public void setLogo(String logo) {
        this.logo = logo;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }
}
