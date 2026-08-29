package com.erp.backend.student.dto;

import java.time.LocalDateTime;

public record StudentListResponse(
        Long id,
        String enrollmentNo,
        String firstName,
        String lastName,
        String name,
        String photoUrl,
        String assignedClass,
        String className,
        String section,
        String rollNo,
        String mobile,
        String email,
        String academicYear,
        String status,
        String transportOptIn,
        String hostelOptIn,
        String libraryOptIn,
        String transportStatus,
        String hostelStatus,
        String libraryStatus,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
