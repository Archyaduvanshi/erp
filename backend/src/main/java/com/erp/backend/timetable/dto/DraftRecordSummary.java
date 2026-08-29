package com.erp.backend.timetable.dto;

import java.time.LocalDateTime;

public record DraftRecordSummary(
        Long id,
        Long academicSessionId,
        Long classId,
        Long sectionId,
        LocalDateTime updatedAt
) {
}
