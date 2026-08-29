package com.erp.backend.transport.dto;

public record TransportOverviewResponse(
        long activeDrivers,
        long activeVehicles,
        long activeRoutes,
        long assignedStudents,
        long todayPresent,
        long todayAbsent
) {
}
