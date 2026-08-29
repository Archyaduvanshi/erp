package com.erp.backend.teacher.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public record TeacherPayload(
        @NotBlank(message = "First name is required") String firstName,
        String lastName,
        String personalEmail,
        String mobileNumber,
        String employeeId,
        String assignedClass,
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
        String documentType,
        String otherDocumentName,
        String fileUploadPath,
        List<TeacherDocumentPayload> documents,
        List<TeacherPaymentPayload> paymentHistory,
        String qrCodeData,
        String cardExpiryDate,
        String photoUrl,
        String status,
        String attendanceStatus
) {
}
