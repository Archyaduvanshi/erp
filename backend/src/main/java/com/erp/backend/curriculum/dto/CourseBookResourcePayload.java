package com.erp.backend.curriculum.dto;

import jakarta.validation.constraints.NotBlank;

public record CourseBookResourcePayload(
        @NotBlank String bookTitle,
        @NotBlank String publisher,
        String language,
        String isbn,
        String edition,
        Boolean primaryBook,
        String status,
        String notes
) {
}
