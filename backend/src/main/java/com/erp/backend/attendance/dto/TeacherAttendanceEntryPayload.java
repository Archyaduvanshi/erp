package com.erp.backend.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TeacherAttendanceEntryPayload(
        @NotNull(message = "Teacher id is required") Long teacherId,
        @NotBlank(message = "Attendance status is required") String status
) {
}
