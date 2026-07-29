package com.erp.backend.hostel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record HostelRoomPayload(
        @NotNull(message = "Hostel is required") Long hostelId,
        @NotBlank(message = "Room number is required") String roomNumber,
        String floorLabel,
        String roomType,
        String acType,
        @Min(value = 1, message = "Capacity must be at least 1") Integer capacity,
        String monthlyCharge,
        String amenities,
        String status
) {
}
