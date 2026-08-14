package com.erp.backend.notice.dto;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record NoticePayload(
        @NotBlank(message = "Notice title is required.")
        String title,
        @NotBlank(message = "Category is required.")
        String category,
        @NotBlank(message = "Audience is required.")
        String audience,
        List<String> targetClasses,
        Long targetStudentId,
        @NotBlank(message = "Priority is required.")
        String priority,
        @NotNull(message = "Publish date is required.")
        LocalDate publishDate,
        LocalDate expireDate,
        @NotBlank(message = "Status is required.")
        String status,
        Boolean isPinned,
        @NotBlank(message = "Summary is required.")
        String summary,
        @NotBlank(message = "Details are required.")
        String details
) {
}
