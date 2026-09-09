package com.erp.backend.scanner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ScanResolveRequest(
        @NotBlank(message = "QR data is required.")
        @Size(max = 160, message = "QR data is invalid.")
        String qrData,

        @NotBlank(message = "Scanner feature is required.")
        @Size(max = 60, message = "Scanner feature is invalid.")
        String feature,

        Long academicSessionId,
        Long classId,
        Long sectionId
) {
}
