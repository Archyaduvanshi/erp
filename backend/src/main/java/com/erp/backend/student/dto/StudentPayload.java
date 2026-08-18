package com.erp.backend.student.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record StudentPayload(
        @NotBlank(message = "First name is required") String firstName,
        String lastName,
        @NotBlank(message = "Date of birth is required") String dob,
        String gender,
        String email,
        @NotBlank(message = "Student mobile number is required")
        @Pattern(regexp = "^$|\\d{10}", message = "Student mobile number must be exactly 10 digits")
        String mobile,
        String regDate,
        String bloodGroup,
        @NotBlank(message = "Permanent address is required") String address,
        @NotBlank(message = "City is required") String city,
        @NotBlank(message = "Pincode is required")
        @Pattern(regexp = "^$|\\d{6}", message = "Pincode must be exactly 6 digits")
        String pincode,
        @NotBlank(message = "State is required") String state,
        @NotBlank(message = "Father first name is required") String guardianFirstName,
        String guardianLastName,
        String guardianName,
        @NotBlank(message = "Mother first name is required") String motherFirstName,
        String motherLastName,
        String motherName,
        @NotBlank(message = "Father mobile number is required")
        @Pattern(regexp = "^$|\\d{10}", message = "Father mobile number must be exactly 10 digits")
        String guardianPhone,
        String prevSchool,
        @NotBlank(message = "Category is required") String category,
        String admissionDate,
        String academicYear,
        String enrollmentNo,
        @NotBlank(message = "Class is required") String className,
        @NotBlank(message = "Section is required") String section,
        String assignedClass,
        @NotBlank(message = "Admission category is required") String admissionCategory,
        @NotBlank(message = "Select transport facility option") String transportOptIn,
        @NotBlank(message = "Select hostel facility option") String hostelOptIn,
        @NotBlank(message = "Select library facility option") String libraryOptIn,
        String transportStatus,
        String hostelStatus,
        String libraryStatus,
        String libraryMonthlyCharge,
        String studentPortalPassword,
        String documentType,
        String otherDocumentName,
        String fileUploadPath,
        List<StudentDocumentPayload> documents,
        String qrCodeData,
        String cardExpiryDate,
        String photoUrl,
        String systemId,
        String status
) {
}
