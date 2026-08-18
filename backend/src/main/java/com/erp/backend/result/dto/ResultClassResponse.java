package com.erp.backend.result.dto;

public record ResultClassResponse(
        String className,
        int studentCount,
        int resultCount,
        int subjectCount
) {
}
