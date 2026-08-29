package com.erp.backend.transport.dto;

import java.time.LocalDateTime;

public record TransportAttendanceResponse(
        Long id,
        String date,
        Long studentId,
        String studentName,
        String className,
        Long driverId,
        Long routeId,
        Long routeOperationId,
        String driverName,
        String busNumber,
        String routeName,
        String pickupStop,
        String status,
        String markedBy,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
