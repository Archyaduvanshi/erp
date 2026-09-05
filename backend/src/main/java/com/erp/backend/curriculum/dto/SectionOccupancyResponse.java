package com.erp.backend.curriculum.dto;

public record SectionOccupancyResponse(
        Long sectionId,
        Long classId,
        String name,
        Integer capacity,
        Long studentCount,
        Integer availableSeats,
        Boolean full,
        String status
) {
}
