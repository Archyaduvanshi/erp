package com.erp.backend.transport.dto;

import java.util.List;

public record TransportRouteOperationResponse(
        Long routeOperationId,
        Long routeId,
        String routeName,
        String routeCode,
        Long driverId,
        String driverName,
        String driverPhone,
        Long vehicleId,
        String busNumber,
        String vehicleType,
        Integer seatCapacity,
        long assignedStudentCount,
        long availableSeats,
        List<TransportRouteStopResponse> stops
) {
}
