package com.erp.backend.hostel.dto;

public record HostelOverviewProjection(
        long totalHostels,
        long totalRooms,
        long totalBeds,
        long occupiedBeds,
        long activeResidents,
        long pendingRequests
) {
}
