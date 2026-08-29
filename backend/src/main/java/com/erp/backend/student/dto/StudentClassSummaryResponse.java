package com.erp.backend.student.dto;

public record StudentClassSummaryResponse(
        String assignedClass,
        long totalStudents,
        long verifiedStudents
) {
}
