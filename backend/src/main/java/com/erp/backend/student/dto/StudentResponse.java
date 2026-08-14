package com.erp.backend.student.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record StudentResponse(
        Long id,
        String firstName,
        String lastName,
        String dob,
        String gender,
        String email,
        String mobile,
        String regDate,
        String bloodGroup,
        String address,
        String city,
        String pincode,
        String state,
        String guardianName,
        String motherName,
        String guardianPhone,
        String prevSchool,
        String category,
        String admissionDate,
        String enrollmentNo,
        String rollNo,
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
        Map<String, Object> facilities,
        String studentPortalPassword,
        String documentType,
        String otherDocumentName,
        String fileUploadPath,
        List<StudentDocumentPayload> documents,
        String qrCodeData,
        String cardExpiryDate,
        String photoUrl,
        String systemId,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
