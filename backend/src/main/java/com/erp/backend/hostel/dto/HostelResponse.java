package com.erp.backend.hostel.dto;

import java.time.LocalDateTime;

public record HostelResponse(
        Long id,
        String hostelName,
        String hostelType,
        Integer totalFloors,
        String wardenName,
        String contactNumber,
        String status,
        Integer totalRooms,
        Integer totalBeds,
        Integer occupiedBeds,
        Integer vacantBeds,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
