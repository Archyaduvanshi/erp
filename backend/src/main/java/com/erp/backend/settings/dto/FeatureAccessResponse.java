package com.erp.backend.settings.dto;

import java.time.LocalDateTime;

public record FeatureAccessResponse(
        String feature,
        boolean enabled,
        boolean passwordSet,
        LocalDateTime updatedAt
) {
}
