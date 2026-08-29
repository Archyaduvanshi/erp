package com.erp.backend.attendance.dto;

import java.util.Map;

public record AttendanceMonthStudentResponse(
        Long studentId,
        String name,
        String rollNo,
        Map<String, String> days
) {
}
