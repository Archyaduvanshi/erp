package com.erp.backend.curriculum.dto;

import java.util.List;

public record ClassResponse(
        Long id,
        String name,
        String code,
        Long academicSessionId,
        String academicSessionName,
        String status,
        Integer displayOrder,
        Long sectionCount,
        List<SectionResponse> sections
) {
}
