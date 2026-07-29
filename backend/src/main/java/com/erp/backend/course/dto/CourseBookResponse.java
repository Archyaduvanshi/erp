package com.erp.backend.course.dto;

import java.time.LocalDateTime;

public record CourseBookResponse(
        Long id,
        String className,
        String subjectName,
        String publisher,
        String language,
        String academicYear,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
