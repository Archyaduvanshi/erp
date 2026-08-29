package com.erp.backend.examination.dto;

import java.util.List;

public record ExamOptionClassResponse(
        Long classId,
        String className,
        List<ExamOptionSectionResponse> sections,
        List<ExamOptionSubjectResponse> subjects
) {
}
