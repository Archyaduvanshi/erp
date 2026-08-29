package com.erp.backend.transport.dto;

public record TransportStudentLookupResponse(
        Long studentId,
        String enrollmentNo,
        String studentName,
        String fatherName,
        String className,
        String section
) {
}
