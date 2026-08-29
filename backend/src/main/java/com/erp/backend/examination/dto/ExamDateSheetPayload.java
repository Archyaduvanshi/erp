package com.erp.backend.examination.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record ExamDateSheetPayload(
        Long academicSessionId,
        Long examId,
        Long classId,
        Long sectionId,
        @NotBlank(message = "Class name is required") String className,
        @NotBlank(message = "Class range from is required") String classFrom,
        @NotBlank(message = "Class range to is required") String classTo,
        Boolean sectionWise,
        @NotBlank(message = "Exam type is required") String examType,
        @NotBlank(message = "Shifts per day is required") String shiftsPerDay,
        @NotEmpty(message = "Shift start time is required") List<String> shiftStartTimes,
        @NotBlank(message = "Shift duration is required") String shiftDurationHours,
        @NotBlank(message = "Shift duration unit is required") String shiftDurationUnit,
        @NotBlank(message = "Exam start date is required") String examStartDate,
        @NotBlank(message = "Exam end date is required") String examEndDate,
        @NotBlank(message = "File name is required") String fileName,
        String fileData,
        String fileType,
        List<String> classColumns,
        Map<String, String> subjectGrid,
        String status
) {
}
