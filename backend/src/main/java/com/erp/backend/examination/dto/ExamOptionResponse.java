package com.erp.backend.examination.dto;

import java.util.List;

public record ExamOptionResponse(
        Long currentAcademicSessionId,
        List<ExamOptionExamResponse> exams,
        List<ExamOptionClassResponse> classes
) {
}
