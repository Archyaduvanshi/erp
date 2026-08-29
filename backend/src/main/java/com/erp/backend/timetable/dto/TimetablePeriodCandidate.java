package com.erp.backend.timetable.dto;

import java.time.LocalTime;

public record TimetablePeriodCandidate(
        String dayOfWeek,
        Integer periodNumber,
        LocalTime startTime,
        LocalTime endTime,
        Long classSubjectId,
        String subjectName,
        Long teacherId,
        String teacherName
) {
}
