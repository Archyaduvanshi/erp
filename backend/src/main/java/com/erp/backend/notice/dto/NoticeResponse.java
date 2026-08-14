package com.erp.backend.notice.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record NoticeResponse(
        Long id,
        String title,
        String category,
        String audience,
        List<String> targetClasses,
        Long targetStudentId,
        String priority,
        LocalDate publishDate,
        LocalDate expireDate,
        String status,
        Boolean isPinned,
        String summary,
        String details,
        String sourceType,
        Long sourceId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
