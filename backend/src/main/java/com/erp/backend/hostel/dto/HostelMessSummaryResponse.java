package com.erp.backend.hostel.dto;

public record HostelMessSummaryResponse(
        long totalResidents,
        long vegetarian,
        long nonVegetarian,
        long unspecified
) {
}
