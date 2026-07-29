package com.erp.backend.examination.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ExamDateSheetResponse(
        Long id,
        String className,
        String classFrom,
        String classTo,
        Boolean sectionWise,
        String examType,
        String shiftsPerDay,
        List<String> shiftStartTimes,
        String shiftDurationHours,
        String shiftDurationUnit,
        String examStartDate,
        String examEndDate,
        String fileName,
        String fileData,
        String fileType,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
