package com.erp.backend.examination.dto;

import jakarta.validation.constraints.NotBlank;

public record ExamAdmitCardPayload(
        @NotBlank(message = "Exam title is required") String examTitle,
        @NotBlank(message = "Student ID is required") String studentId,
        String studentName,
        String rollNo,
        String className,
        @NotBlank(message = "Center name is required") String centerName,
        @NotBlank(message = "Reporting time is required") String reportingTime,
        @NotBlank(message = "Exam date is required") String examDate
) {
}
