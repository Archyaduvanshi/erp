package com.erp.backend.hostel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record HostelResidentPayload(
        @NotNull(message = "Student is required") Long studentId,
        @NotNull(message = "Room is required") Long roomId,
        @Size(max = 30, message = "Bed number cannot exceed 30 characters")
        String bedNumber,
        @NotBlank(message = "Check-in date is required") String checkInDate,
        @Pattern(regexp = "^$|\\d+(\\.\\d{1,2})?", message = "Monthly charge must be a valid number")
        String monthlyCharge,
        @Pattern(regexp = "^$|\\d{10}", message = "Guardian contact must contain 10 digits")
        String guardianContact,
        @Pattern(regexp = "^(select|vegetarian|non-vegetarian)?$", message = "Mess food must be select, vegetarian, or non-vegetarian")
        String messFood,
        @Pattern(regexp = "^$|\\d{10}", message = "Emergency contact must contain 10 digits")
        String emergencyContact,
        @Size(max = 1000, message = "Notes cannot exceed 1000 characters")
        String notes,
        @Pattern(regexp = "^(active|inactive)$", message = "Status must be active or inactive")
        String status
) {
}
