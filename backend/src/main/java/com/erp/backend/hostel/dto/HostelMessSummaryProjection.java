package com.erp.backend.hostel.dto;

public record HostelMessSummaryProjection(
        long totalResidents,
        long vegetarian,
        long nonVegetarian,
        long unspecified
) {
}
