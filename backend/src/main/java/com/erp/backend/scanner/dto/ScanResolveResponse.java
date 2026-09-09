package com.erp.backend.scanner.dto;

public record ScanResolveResponse(
        String entityType,
        Long id,
        String name,
        String referenceNumber,
        Long classId,
        Long sectionId,
        String className,
        String section,
        String rollNo,
        String department,
        String photoUrl
) {
}
