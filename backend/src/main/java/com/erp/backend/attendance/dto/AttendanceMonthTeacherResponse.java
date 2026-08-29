package com.erp.backend.attendance.dto;

public record AttendanceMonthTeacherResponse(
        Long teacherId,
        String teacherName,
        String employeeId
) {
}
