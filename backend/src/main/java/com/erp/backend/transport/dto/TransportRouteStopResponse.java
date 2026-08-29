package com.erp.backend.transport.dto;

public record TransportRouteStopResponse(
        Long id,
        String stopName,
        Integer stopOrder
) {
}
