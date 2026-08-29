package com.erp.backend.marks.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record StudentMarksRegisterPayload(
        Long academicSessionId,
        Long classId,
        @NotBlank String className,
        Long subjectId,
        @NotBlank String subjectName,
        String uploadedBy,
        @Valid @NotEmpty List<StudentMarksExamPayload> exams
) {
}
