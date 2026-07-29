package com.erp.backend.transport.dto;

import jakarta.validation.constraints.NotBlank;

public record TransportDriverPayload(
        @NotBlank(message = "Driver name is required") String driverName,
        String driverPhone,
        String driverLicense,
        String salary,
        String busNumber,
        String routeName,
        String routeCode,
        String vehicleType,
        Integer seatCapacity,
        String pickupPoints,
        String status
) {
}
