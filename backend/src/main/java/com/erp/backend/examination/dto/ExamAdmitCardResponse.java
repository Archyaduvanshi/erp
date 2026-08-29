package com.erp.backend.examination.dto;

import java.time.LocalDateTime;

public record ExamAdmitCardResponse(
        Long id,
        Long academicSessionId,
        Long examId,
        Long realStudentId,
        Long classId,
        Long sectionId,
        String examTitle,
        String studentId,
        String studentName,
        String rollNo,
        String className,
        String centerName,
        String reportingTime,
        String examDate,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
