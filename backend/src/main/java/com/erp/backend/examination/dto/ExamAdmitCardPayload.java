package com.erp.backend.examination.dto;

import jakarta.validation.constraints.NotBlank;

public record ExamAdmitCardPayload(
        @NotBlank(message = "Exam title is required") String examTitle,
        @NotBlank(message = "Student ID is required") String studentId,
        @NotBlank(message = "Student name is required") String studentName,
        @NotBlank(message = "Roll number is required") String rollNo,
        @NotBlank(message = "Class name is required") String className,
        @NotBlank(message = "Center name is required") String centerName,
        @NotBlank(message = "Reporting time is required") String reportingTime,
        @NotBlank(message = "Exam date is required") String examDate
) {
}
