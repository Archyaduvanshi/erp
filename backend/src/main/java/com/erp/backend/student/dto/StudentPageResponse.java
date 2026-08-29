package com.erp.backend.student.dto;

import java.util.List;

public record StudentPageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
