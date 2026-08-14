package com.erp.backend.marks.dto;

import jakarta.validation.constraints.NotBlank;

public record StudentMarksExamRenamePayload(
        @NotBlank String className,
        @NotBlank String subjectName,
        @NotBlank String oldTitle,
        @NotBlank String newTitle
) {
}
