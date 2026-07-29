package com.erp.backend.transport.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record TransportAttendanceSaveRequest(
        @NotNull(message = "Driver is required") Long driverId,
        @NotBlank(message = "Attendance date is required") String date,
        String markedBy,
        @Valid @NotEmpty(message = "At least one student attendance entry is required") List<TransportAttendanceEntryPayload> entries
) {
}
