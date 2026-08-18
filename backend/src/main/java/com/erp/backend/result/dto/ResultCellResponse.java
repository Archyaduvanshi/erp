package com.erp.backend.result.dto;

import java.math.BigDecimal;

public record ResultCellResponse(
        String subjectName,
        String examKey,
        BigDecimal maxMarks,
        BigDecimal marksObtained,
        int percentage,
        String status,
        String uploadedBy
) {
}
