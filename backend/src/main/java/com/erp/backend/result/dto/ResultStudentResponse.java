package com.erp.backend.result.dto;

public record ResultStudentResponse(
        Long id,
        String name,
        String rollNo,
        String className,
        int subjectCount,
        String status
) {
}
