package com.erp.backend.attendance.dto;

import java.util.List;

public record TeacherAttendanceMonthResponse(
        String month,
        List<TeacherAttendanceMonthTeacherResponse> teachers
) {
}
