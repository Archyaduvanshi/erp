package com.erp.backend.scanner.dto;

public record QrRegenerateResponse(
        String entityType,
        Long id,
        String qrCodeData
) {
}
