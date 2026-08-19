package com.erp.backend.report.dto;

import jakarta.validation.constraints.NotBlank;

public record ReportSnapshotPayload(
        @NotBlank String category,
        @NotBlank String reportKey,
        @NotBlank String title,
        String filtersJson,
        String kpisJson,
        String chartsJson,
        String rowsJson,
        Integer rowCount,
        String generatedAt
) {
}
