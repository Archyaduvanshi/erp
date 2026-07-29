package com.erp.backend.attendance.dto;

import jakarta.validation.constraints.NotNull;

public record AttendanceEntryPayload(
        @NotNull(message = "Student is required") Long studentId,
        String status
) {
}
