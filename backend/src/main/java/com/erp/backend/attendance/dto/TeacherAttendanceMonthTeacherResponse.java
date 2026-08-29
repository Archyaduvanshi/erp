package com.erp.backend.attendance.dto;

import java.util.Map;

public record TeacherAttendanceMonthTeacherResponse(
        Long teacherId,
        String teacherName,
        String employeeId,
        String specialization,
        Map<String, String> days
) {
}
