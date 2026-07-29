package com.erp.backend.examination.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public record ExamDateSheetPayload(
        @NotBlank(message = "Class name is required") String className,
        String classFrom,
        String classTo,
        Boolean sectionWise,
        @NotBlank(message = "Exam type is required") String examType,
        String shiftsPerDay,
        List<String> shiftStartTimes,
        String shiftDurationHours,
        String shiftDurationUnit,
        String examStartDate,
        String examEndDate,
        @NotBlank(message = "File name is required") String fileName,
        @NotBlank(message = "File data is required") String fileData,
        String fileType
) {
}
