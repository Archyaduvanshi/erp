package com.erp.backend.hostel.dto;

public record HostelOverviewResponse(
        int totalHostels,
        int totalRooms,
        int totalBeds,
        int occupiedBeds,
        int vacantBeds,
        int studentsInHostel,
        int pendingRequests
) {
}
