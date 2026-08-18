package com.erp.backend.result.dto;

public record ResultExamColumnResponse(
        String key,
        String title,
        String examDate,
        String maxMarksLabel
) {
}
