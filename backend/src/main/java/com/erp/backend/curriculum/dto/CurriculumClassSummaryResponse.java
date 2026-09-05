package com.erp.backend.curriculum.dto;

import java.util.List;

public record CurriculumClassSummaryResponse(
        Long classId,
        String className,
        String classCode,
        Integer displayOrder,
        Long subjectCount,
        Long bookCount,
        Long sectionCount,
        Long studentCount,
        Integer totalCapacity,
        Integer availableSeats,
        List<SectionResponse> sections,
        String status
) {
    public CurriculumClassSummaryResponse(Long classId, String className, Long subjectCount, Long bookCount, String status) {
        this(classId, className, null, 0, subjectCount, bookCount, 0L, 0L, 0, 0, List.of(), status);
    }

    public CurriculumClassSummaryResponse(Long classId, String className, String classCode, Integer displayOrder, Long subjectCount, Long bookCount, Long sectionCount, String status) {
        this(classId, className, classCode, displayOrder, subjectCount, bookCount, sectionCount, 0L, 0, 0, List.of(), status);
    }
}
