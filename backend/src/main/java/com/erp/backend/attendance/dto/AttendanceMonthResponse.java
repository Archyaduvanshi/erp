package com.erp.backend.attendance.dto;

import java.util.List;

public record AttendanceMonthResponse(
        Long classId,
        Long sectionId,
        String month,
        Long attendanceTeacherId,
        String attendanceTeacherName,
        String attendanceTeacherEmployeeId,
        List<AttendanceMonthTeacherResponse> teachers,
        List<AttendanceMonthStudentResponse> students
) {
}
