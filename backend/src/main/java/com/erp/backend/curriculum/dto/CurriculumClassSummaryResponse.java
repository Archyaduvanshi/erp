package com.erp.backend.curriculum.dto;

public record CurriculumClassSummaryResponse(
        Long classId,
        String className,
        Long subjectCount,
        Long bookCount,
        String status
) {
}
