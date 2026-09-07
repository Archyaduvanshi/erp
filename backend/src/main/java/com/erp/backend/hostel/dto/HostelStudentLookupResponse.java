package com.erp.backend.hostel.dto;

public record HostelStudentLookupResponse(
        Long studentId,
        String enrollmentNo,
        String studentName,
        String fatherName,
        String guardianPhone,
        String className,
        String section
) {
}
