package com.erp.backend.curriculum.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public record ClassCreatePayload(
        @NotBlank(message = "CLASS_NAME_REQUIRED") String name,
        String code,
        Long academicSessionId,
        List<SectionCreatePayload> sections,
        Integer displayOrder,
        String status
) {
}
