package com.erp.backend.examination.dto;

import jakarta.validation.constraints.NotBlank;

public record ExamAdmitCardBulkPayload(
        Long academicSessionId,
        Long examId,
        Long classId,
        Long sectionId,
        @NotBlank(message = "Exam title is required") String examTitle,
        @NotBlank(message = "Class name is required") String className,
        @NotBlank(message = "Center name is required") String centerName,
        @NotBlank(message = "Reporting time is required") String reportingTime,
        @NotBlank(message = "Exam date is required") String examDate,
        String status
) {
}
