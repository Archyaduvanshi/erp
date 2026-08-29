package com.erp.backend.result.dto;

import java.math.BigDecimal;

public record ResultCellResponse(
        Long subjectId,
        String subjectName,
        Long examId,
        String examKey,
        BigDecimal maxMarks,
        BigDecimal marksObtained,
        int percentage,
        String status,
        String uploadedBy
) {
}
