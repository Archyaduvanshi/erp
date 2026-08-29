package com.erp.backend.hostel.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record HostelResidentResponse(
        Long id,
        Long studentId,
        String studentName,
        String className,
        String section,
        String enrollmentNo,
        Long hostelId,
        String hostelName,
        Long roomId,
        String roomNumber,
        String floorLabel,
        String bedNumber,
        LocalDate checkInDate,
        LocalDate checkOutDate,
        java.math.BigDecimal monthlyCharge,
        String guardianContact,
        String messFood,
        String emergencyContact,
        String notes,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
