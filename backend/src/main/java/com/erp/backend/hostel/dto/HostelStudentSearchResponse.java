package com.erp.backend.hostel.dto;

public record HostelStudentSearchResponse(
        Long studentId,
        String enrollmentNo,
        String studentName,
        String className,
        String section,
        String fatherName,
        String guardianPhone,
        String hostelRequestStatus,
        boolean currentlyAllotted
) {
}
