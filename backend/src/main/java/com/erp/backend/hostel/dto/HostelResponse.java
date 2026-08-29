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
        Long totalRooms,
        Long totalBeds,
        Long occupiedBeds,
        Long vacantBeds,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
