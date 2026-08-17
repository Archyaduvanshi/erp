package com.erp.backend.hostel.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record HostelPayload(
        @NotBlank(message = "Hostel name is required")
        @Size(min = 2, max = 100, message = "Hostel name must contain 2-100 characters")
        String hostelName,
        @Pattern(regexp = "^(boys|girls)$", message = "Hostel type must be boys or girls")
        String hostelType,
        @Min(value = 1, message = "Total floors must be at least 1") Integer totalFloors,
        @Size(max = 80, message = "Warden name cannot exceed 80 characters")
        String wardenName,
        @Pattern(regexp = "^$|\\d{10}", message = "Contact number must contain 10 digits")
        String contactNumber,
        @Pattern(regexp = "^(active|inactive)$", message = "Status must be active or inactive")
        String status
) {
}
