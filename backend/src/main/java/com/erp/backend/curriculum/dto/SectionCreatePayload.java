package com.erp.backend.curriculum.dto;

import jakarta.validation.constraints.NotBlank;

public record SectionCreatePayload(
        @NotBlank(message = "SECTION_NAME_REQUIRED") String name,
        Integer maxStudents,
        String status
) {
}
