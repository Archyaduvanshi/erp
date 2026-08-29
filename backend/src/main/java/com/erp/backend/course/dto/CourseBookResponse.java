package com.erp.backend.course.dto;

import java.time.LocalDateTime;

public record CourseBookResponse(
        Long id,
        Long classSubjectId,
        Long subjectId,
        Long classId,
        String className,
        String subjectName,
        String subjectCode,
        String bookTitle,
        String publisher,
        String language,
        String academicYear,
        String isbn,
        String edition,
        Boolean primaryBook,
        String status,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
