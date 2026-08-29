package com.erp.backend.fee.dto;

public record FeeStudentSearchResponse(
        Long id,
        String enrollmentNo,
        String studentName,
        String className,
        String section,
        String category,
        String currentFeeStatus,
        String transportStatus,
        String hostelStatus,
        String libraryStatus,
        String libraryMonthlyCharge
) {
}
