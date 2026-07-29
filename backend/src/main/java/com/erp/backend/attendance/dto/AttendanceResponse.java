package com.erp.backend.attendance.dto;

import java.time.LocalDateTime;

public record AttendanceResponse(
        Long id,
        String date,
        String lectureNumber,
        String subject,
        String markedBy,
        String className,
        Long studentId,
        String studentName,
        String rollNo,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
