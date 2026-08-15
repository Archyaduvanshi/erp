package com.erp.backend.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TeacherResponse(
        Long id,
        String firstName,
        String lastName,
        String personalEmail,
        String mobileNumber,
        String employeeId,
        String address,
        String city,
        String state,
        String pincode,
        String specialization,
        String experienceYears,
        String contractType,
        String leaveBalance,
        String salary,
        String dob,
        String joiningDate,
        String teacherPortalPassword,
        String documentType,
        String otherDocumentName,
        String fileUploadPath,
        List<TeacherDocumentPayload> documents,
        List<TeacherPaymentPayload> paymentHistory,
        String qrCodeData,
        String cardExpiryDate,
        String photoUrl,
        String teacherSystemId,
        String status,
        String attendanceStatus,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
