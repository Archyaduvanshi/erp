package com.erp.backend.notice.dto;

public record PortalNoticeOverviewResponse(
        long total,
        long pinned,
        long urgent
) {
}
