package com.erp.backend.transport.dto;

import java.time.LocalDateTime;

public record TransportDriverResponse(
        Long id,
        String driverName,
        String driverPhone,
        String driverLicense,
        String salary,
        String busNumber,
        String routeName,
        String routeCode,
        String vehicleType,
        Integer seatCapacity,
        String pickupPoints,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
