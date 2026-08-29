package com.erp.backend.curriculum.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record ClassSubjectBulkPayload(
        @NotNull Long academicSessionId,
        @NotNull Long classId,
        @NotEmpty List<@Valid ClassSubjectPayload> subjects
) {
}
