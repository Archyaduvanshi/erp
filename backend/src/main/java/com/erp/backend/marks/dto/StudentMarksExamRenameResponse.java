package com.erp.backend.marks.dto;

import java.time.LocalDateTime;

public record StudentMarksExamRenameResponse(
        Long id,
        String className,
        String subjectName,
        String oldTitle,
        String newTitle,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
