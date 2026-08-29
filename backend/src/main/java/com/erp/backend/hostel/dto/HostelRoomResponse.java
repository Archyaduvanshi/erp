package com.erp.backend.hostel.dto;

import java.time.LocalDateTime;
import java.math.BigDecimal;

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
        BigDecimal monthlyCharge,
        String amenities,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
