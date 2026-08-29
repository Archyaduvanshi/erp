package com.erp.backend.transport.dto;

import java.time.LocalDateTime;

public record TransportAssignmentResponse(
        Long id,
        Long academicSessionId,
        Long studentId,
        String studentName,
        String className,
        String pickupStop,
        Long routeId,
        Long pickupStopId,
        Long assignedDriverId,
        String driverName,
        String driverPhone,
        String busNumber,
        String routeName,
        String vehicleType,
        String pickupPoints,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
