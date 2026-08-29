package com.erp.backend.attendance.dto;

public record AttendanceStudentResponse(
        Long studentId,
        String name,
        String rollNo,
        String admissionNo
) {
}
