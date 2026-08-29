package com.erp.backend.teacher.dto;

import java.util.List;

public record TeacherPageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
