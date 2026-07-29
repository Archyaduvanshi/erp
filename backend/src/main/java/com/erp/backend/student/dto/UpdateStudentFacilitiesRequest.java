package com.erp.backend.student.dto;

public record UpdateStudentFacilitiesRequest(
        String transportOptIn,
        String hostelOptIn,
        String libraryOptIn,
        String transportStatus,
        String hostelStatus,
        String libraryStatus,
        String libraryMonthlyCharge
) {
}
