package com.erp.backend.notice.dto;

public record NoticeOverviewResponse(
        long total,
        long published,
        long scheduled,
        long draft,
        long archived,
        long urgent
) {
}
