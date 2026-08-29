package com.erp.backend.attendance.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record AttendanceSessionSaveRequest(
        @NotNull(message = "Academic session is required") Long academicSessionId,
        @NotNull(message = "Class is required") Long classId,
        Long sectionId,
        @NotBlank(message = "Attendance date is required") String date,
        Integer periodNumber,
        Long classSubjectId,
        Long markedByTeacherId,
        @Valid @NotEmpty(message = "At least one student attendance entry is required") List<AttendanceEntryPayload> entries
) {
}
