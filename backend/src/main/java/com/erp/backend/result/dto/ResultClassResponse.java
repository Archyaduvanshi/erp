package com.erp.backend.result.dto;

public record ResultClassResponse(
        String className,
        long studentCount,
        long resultCount,
        long subjectCount
) {
}
