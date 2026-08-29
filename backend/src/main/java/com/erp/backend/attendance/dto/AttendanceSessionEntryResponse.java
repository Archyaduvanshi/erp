package com.erp.backend.attendance.dto;

public record AttendanceSessionEntryResponse(
        Long studentId,
        String status
) {
}
