package com.erp.backend.curriculum.dto;

import jakarta.validation.constraints.NotNull;

public record CopyCurriculumRequest(
        @NotNull Long sourceAcademicSessionId,
        @NotNull Long targetAcademicSessionId,
        @NotNull Long classId,
        Boolean copySubjects,
        Boolean copyBooks
) {
}
