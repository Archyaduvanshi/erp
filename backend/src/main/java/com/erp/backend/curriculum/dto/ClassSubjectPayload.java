package com.erp.backend.curriculum.dto;

import jakarta.validation.constraints.NotNull;

public record ClassSubjectPayload(
        @NotNull Long academicSessionId,
        @NotNull Long classId,
        Long subjectId,
        String subjectName,
        String subjectCode,
        String subjectType,
        Integer displayOrder,
        String status,
        String notes
) {
}
