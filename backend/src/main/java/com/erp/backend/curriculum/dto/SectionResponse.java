package com.erp.backend.curriculum.dto;

public record SectionResponse(
        Long id,
        String name,
        String status,
        Integer maxStudents,
        Long studentCount,
        Integer availableSeats,
        Boolean full
) {
    public SectionResponse(Long id, String name, String status) {
        this(id, name, status, 30, 0L, 30, false);
    }
}
