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
        List<Long> targetClassIds,
        List<NoticeTargetClassResponse> targetClassTargets,
        Long targetStudentId,
        Long targetTeacherId,
        String priority,
        LocalDate publishDate,
        LocalDate expireDate,
        String status,
        String liveStatus,
        Boolean isPinned,
        String summary,
        String details,
        String sourceType,
        Long sourceId,
        Long createdByAccountId,
        Long updatedByAccountId,
        Long publishedByAccountId,
        Long archivedByAccountId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime publishedAt,
        LocalDateTime archivedAt
) {
}
