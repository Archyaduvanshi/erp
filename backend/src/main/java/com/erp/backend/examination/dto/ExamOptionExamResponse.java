package com.erp.backend.examination.dto;

public record ExamOptionExamResponse(
        Long examId,
        String examName,
        String examType,
        String startDate,
        String endDate,
        String status
) {
}
