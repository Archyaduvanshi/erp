package com.erp.backend.library.dto;

public record LibraryStudentSearchResponse(
        Long studentId,
        String name,
        String enrollmentNo,
        String rollNo,
        String className,
        String sectionName,
        String libraryFacilityStatus
) {
}
