package com.erp.backend.timetable.dto;

public record TimetablePeriodResponse(
        Long id,
        String dayOfWeek,
        Integer periodNumber,
        String startTime,
        String endTime,
        Long classId,
        Long sectionId,
        String className,
        String sectionName,
        Long classSubjectId,
        Long subjectId,
        String subjectName,
        Long teacherId,
        String teacherName
) {
}
