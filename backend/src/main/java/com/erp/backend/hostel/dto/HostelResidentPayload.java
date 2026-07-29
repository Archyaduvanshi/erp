package com.erp.backend.hostel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record HostelResidentPayload(
        @NotNull(message = "Student is required") Long studentId,
        @NotNull(message = "Room is required") Long roomId,
        String bedNumber,
        @NotBlank(message = "Check-in date is required") String checkInDate,
        String monthlyCharge,
        String guardianContact,
        String emergencyContact,
        String notes,
        String status
) {
}
