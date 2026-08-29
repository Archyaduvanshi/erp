package com.erp.backend.student.dto;

public record StudentPortalLoginResponse(
        Long instituteId,
        String instituteName,
        String instituteUsername,
        String instituteType,
        String instituteLogo,
        Long studentId,
        String enrollmentNo,
        String studentName
) {
}
