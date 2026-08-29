package com.erp.backend.result.dto;

import java.time.LocalDateTime;

public record ResultPublicationResponse(
        Long id,
        Long academicSessionId,
        Long classId,
        String className,
        Long examId,
        String examTitle,
        String status,
        Long publishedByAccountId,
        LocalDateTime publishedAt,
        Long reopenedByAccountId,
        LocalDateTime reopenedAt,
        String reopenReason,
        LocalDateTime lockedAt
) {
}
