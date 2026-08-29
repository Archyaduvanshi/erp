package com.erp.backend.timetable.dto;

import java.time.LocalDateTime;

public record TimetableTemplateDraftResponse(
        Long id,
        Long academicSessionId,
        Long classId,
        Long sectionId,
        String sectionName,
        String className,
        Object draftData,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
