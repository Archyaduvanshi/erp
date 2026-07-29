package com.erp.backend.hostel.dto;

import java.time.LocalDateTime;

public record HostelRoomResponse(
        Long id,
        Long hostelId,
        String hostelName,
        String hostelType,
        String roomNumber,
        String floorLabel,
        String roomType,
        String acType,
        Integer capacity,
        Integer occupiedBeds,
        String monthlyCharge,
        String amenities,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
