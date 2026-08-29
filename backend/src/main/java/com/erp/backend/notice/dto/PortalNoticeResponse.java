package com.erp.backend.notice.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PortalNoticeResponse(
        Long id,
        String title,
        String category,
        String priority,
        LocalDate publishDate,
        LocalDate expireDate,
        Boolean isPinned,
        String summary,
        LocalDateTime createdAt
) {
}
