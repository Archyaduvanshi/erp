package com.erp.backend.marks.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record StudentMarksRegisterPayload(
        @NotBlank String className,
        @NotBlank String subjectName,
        @NotBlank String uploadedBy,
        @Valid @NotEmpty List<StudentMarksExamPayload> exams
) {
}
