package com.erp.backend.examination.dto;

import java.time.LocalDateTime;

public record ExamAdmitCardResponse(
        Long id,
        String examTitle,
        String studentId,
        String studentName,
        String rollNo,
        String className,
        String centerName,
        String reportingTime,
        String examDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
