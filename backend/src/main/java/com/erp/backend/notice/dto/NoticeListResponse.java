package com.erp.backend.notice.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record NoticeListResponse(
        Long id,
        String title,
        String category,
        String audience,
        String priority,
        LocalDate publishDate,
        LocalDate expireDate,
        String status,
        String liveStatus,
        Boolean isPinned,
        String summary,
        String sourceType,
        Long sourceId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
