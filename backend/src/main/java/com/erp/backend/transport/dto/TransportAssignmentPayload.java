package com.erp.backend.transport.dto;

import jakarta.validation.constraints.NotNull;

public record TransportAssignmentPayload(
        @NotNull(message = "Student is required") Long studentId,
        Long assignedDriverId,
        String pickupStop
) {
}
