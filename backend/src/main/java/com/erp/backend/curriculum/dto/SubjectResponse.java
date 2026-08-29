package com.erp.backend.curriculum.dto;

public record SubjectResponse(
        Long id,
        String name,
        String code,
        String status,
        String description
) {
}
