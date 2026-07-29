package com.erp.backend.transport.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TransportAttendanceEntryPayload(
        @NotNull(message = "Student is required") Long studentId,
        @NotBlank(message = "Attendance status is required") String status,
        String notes
) {
}
