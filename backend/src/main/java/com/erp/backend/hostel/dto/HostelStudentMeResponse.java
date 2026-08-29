package com.erp.backend.hostel.dto;

public record HostelStudentMeResponse(
        Long studentId,
        String studentName,
        String className,
        String section,
        String enrollmentNo,
        String guardianPhone,
        String hostelOptIn,
        String hostelStatus,
        boolean hostelFacilityActive,
        HostelResidentResponse resident
) {
}
