package com.erp.backend.examination.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ExamDateSheetResponse(
        Long id,
        Long academicSessionId,
        Long examId,
        Long classId,
        Long sectionId,
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
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
