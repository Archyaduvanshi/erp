package com.erp.backend.examination.dto;

import java.time.LocalDateTime;

public record ExamQuestionPaperResponse(
        Long id,
        Long academicSessionId,
        Long examId,
        Long classId,
        Long subjectId,
        String examTitle,
        String className,
        String subjectName,
        String uploadedBy,
        String fileName,
        String fileData,
        String fileType,
        String status,
        String releaseAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
