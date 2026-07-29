package com.erp.backend.attendance.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record AttendanceSaveRequest(
        @NotBlank(message = "Class name is required") String className,
        @NotBlank(message = "Attendance date is required") String date,
        @NotBlank(message = "Lecture number is required") String lectureNumber,
        @NotBlank(message = "Subject is required") String subject,
        @NotBlank(message = "Marked by is required") String markedBy,
        @Valid @NotEmpty(message = "At least one student attendance entry is required") List<AttendanceEntryPayload> entries
) {
}
