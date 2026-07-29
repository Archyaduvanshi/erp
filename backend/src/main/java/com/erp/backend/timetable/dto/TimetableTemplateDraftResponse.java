package com.erp.backend.timetable.dto;

import java.time.LocalDateTime;

public record TimetableTemplateDraftResponse(
        Long id,
        String className,
        Object draftData,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
