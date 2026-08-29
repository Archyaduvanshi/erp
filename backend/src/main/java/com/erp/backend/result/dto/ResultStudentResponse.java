package com.erp.backend.result.dto;

public record ResultStudentResponse(
        Long id,
        String name,
        String rollNo,
        String className,
        long subjectCount,
        String status
) {
}
