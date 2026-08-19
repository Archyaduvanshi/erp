package com.erp.backend.report.dto;

import java.time.LocalDateTime;

public record ReportSnapshotResponse(
        Long id,
        String category,
        String reportKey,
        String title,
        String filtersJson,
        String kpisJson,
        String chartsJson,
        String rowsJson,
        Integer rowCount,
        LocalDateTime generatedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
