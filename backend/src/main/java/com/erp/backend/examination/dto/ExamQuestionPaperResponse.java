package com.erp.backend.examination.dto;

import java.time.LocalDateTime;

public record ExamQuestionPaperResponse(
        Long id,
        String examTitle,
        String className,
        String subjectName,
        String uploadedBy,
        String fileName,
        String fileData,
        String fileType,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
