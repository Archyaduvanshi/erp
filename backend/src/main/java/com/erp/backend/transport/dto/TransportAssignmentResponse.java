package com.erp.backend.transport.dto;

import java.time.LocalDateTime;

public record TransportAssignmentResponse(
        Long id,
        Long studentId,
        String studentName,
        String className,
        String pickupStop,
        Long assignedDriverId,
        String driverName,
        String driverPhone,
        String busNumber,
        String routeName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
