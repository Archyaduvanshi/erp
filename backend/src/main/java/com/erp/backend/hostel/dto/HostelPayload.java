package com.erp.backend.hostel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record HostelPayload(
        @NotBlank(message = "Hostel name is required") String hostelName,
        String hostelType,
        @Min(value = 1, message = "Total floors must be at least 1") Integer totalFloors,
        String wardenName,
        String contactNumber,
        String status
) {
}
