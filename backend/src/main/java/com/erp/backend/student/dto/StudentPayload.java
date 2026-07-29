package com.erp.backend.student.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public record StudentPayload(
        @NotBlank(message = "First name is required") String firstName,
        String lastName,
        String dob,
        String gender,
        String email,
        String mobile,
        String regDate,
        String bloodGroup,
        String address,
        String guardianName,
        String motherName,
        String guardianPhone,
        String prevSchool,
        String category,
        String admissionDate,
        String enrollmentNo,
        String className,
        String section,
        String assignedClass,
        String admissionCategory,
        String transportOptIn,
        String hostelOptIn,
        String libraryOptIn,
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
