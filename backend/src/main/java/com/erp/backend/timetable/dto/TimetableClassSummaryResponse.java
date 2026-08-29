package com.erp.backend.timetable.dto;

import java.time.LocalDateTime;

public record TimetableClassSummaryResponse(
        Long academicSessionId,
        Long classId,
        String className,
        Long sectionId,
        String sectionName,
        String displayName,
        Long subjectClassId,
        String subjectClassName,
        Long timetableId,
        boolean hasTimetable,
        Long draftId,
        boolean hasDraft,
        LocalDateTime updatedAt
) {
}
