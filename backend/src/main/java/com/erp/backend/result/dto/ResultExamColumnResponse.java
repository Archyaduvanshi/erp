package com.erp.backend.result.dto;

public record ResultExamColumnResponse(
        Long examId,
        String key,
        String title,
        String examDate,
        String maxMarksLabel
) {
}
