package com.erp.backend.hostel.dto;

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
        String checkInDate,
        String checkOutDate,
        String monthlyCharge,
        String guardianContact,
        String emergencyContact,
        String notes,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
