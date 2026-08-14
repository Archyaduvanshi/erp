package com.erp.backend.marks.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StudentMarkResponse(
        Long id,
        String className,
        String subjectName,
        String examTitle,
        String examDate,
        BigDecimal maxMarks,
        BigDecimal marksObtained,
        Long studentId,
        String studentName,
        String rollNo,
        String uploadedBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
