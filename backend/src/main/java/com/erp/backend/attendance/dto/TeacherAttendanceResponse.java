package com.erp.backend.attendance.dto;

import java.time.LocalDateTime;

public record TeacherAttendanceResponse(
        Long id,
        Long teacherId,
        String teacherName,
        String employeeId,
        String specialization,
        String date,
        String status,
        String markedBy,
        Long markedByUserId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
