package com.erp.backend.attendance.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record TeacherAttendanceSaveRequest(
        @NotBlank(message = "Attendance date is required") String date,
        @NotBlank(message = "Marked by is required") String markedBy,
        @Valid @NotEmpty(message = "At least one teacher attendance entry is required") List<TeacherAttendanceEntryPayload> entries
) {
}
