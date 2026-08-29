package com.erp.backend.timetable.dto;

import java.time.LocalTime;

public record TimetablePeriodProjection(
        Long id,
        Long timetableId,
        Long teacherId,
        String dayOfWeek,
        Integer periodNumber,
        LocalTime startTime,
        LocalTime endTime,
        Long classId,
        String className,
        Long sectionId,
        String sectionName,
        Long classSubjectId,
        String subjectName,
        String teacherName,
        String employeeId
) {
}
