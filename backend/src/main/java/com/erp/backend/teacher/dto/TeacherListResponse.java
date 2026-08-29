package com.erp.backend.teacher.dto;

import java.time.LocalDateTime;

public record TeacherListResponse(
        Long id,
        String employeeId,
        String fullName,
        String firstName,
        String lastName,
        String photoUrl,
        String mobileNumber,
        String personalEmail,
        String specialization,
        String contractType,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
