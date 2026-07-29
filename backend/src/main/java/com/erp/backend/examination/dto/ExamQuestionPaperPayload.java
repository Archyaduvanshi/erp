package com.erp.backend.examination.dto;

import jakarta.validation.constraints.NotBlank;

public record ExamQuestionPaperPayload(
        @NotBlank(message = "Exam title is required") String examTitle,
        @NotBlank(message = "Class name is required") String className,
        @NotBlank(message = "Subject name is required") String subjectName,
        String uploadedBy,
        @NotBlank(message = "File name is required") String fileName,
        @NotBlank(message = "File data is required") String fileData,
        String fileType
) {
}
