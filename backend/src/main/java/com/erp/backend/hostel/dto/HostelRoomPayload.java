package com.erp.backend.hostel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record HostelRoomPayload(
        @NotNull(message = "Hostel is required") Long hostelId,
        @NotBlank(message = "Room number is required")
        @Size(max = 30, message = "Room number cannot exceed 30 characters")
        String roomNumber,
        @Size(max = 50, message = "Floor cannot exceed 50 characters")
        String floorLabel,
        @Pattern(regexp = "^(Standard|Single|Double|Dormitory)$", message = "Room type is invalid")
        String roomType,
        @Pattern(regexp = "^(ac|non-ac)$", message = "AC type must be ac or non-ac")
        String acType,
        @Min(value = 1, message = "Capacity must be at least 1") Integer capacity,
        @Pattern(regexp = "^$|\\d+(\\.\\d{1,2})?", message = "Monthly charge must be a valid number")
        String monthlyCharge,
        @Size(max = 500, message = "Amenities cannot exceed 500 characters")
        String amenities,
        @Pattern(regexp = "^(available|maintenance|full)$", message = "Status must be available, maintenance, or full")
        String status
) {
}
