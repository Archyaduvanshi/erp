package com.erp.backend.institute.dto;

import java.time.LocalDateTime;

public class InstituteResponse {

    private Long id;
    private String instituteName;
    private String type;
    private String username;
    private String affiliationNo;
    private String affiliatedFrom;
    private String contact;
    private String email;
    private String website;
    private String address;
    private String state;
    private String city;
    private String pincode;
    private String logo;
    private LocalDateTime registeredDate;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public LocalDateTime getRegisteredDate() {
        return registeredDate;
    }

    public void setRegisteredDate(LocalDateTime registeredDate) {
        this.registeredDate = registeredDate;
    }
}
