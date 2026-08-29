package com.erp.backend.timetable.service;

import java.time.LocalTime;

import com.erp.backend.curriculum.entity.ClassSubject;
import com.erp.backend.teacher.entity.Teacher;

public record ResolvedTimetablePeriod(
        String dayOfWeek,
        Integer periodNumber,
        LocalTime startTime,
        LocalTime endTime,
        ClassSubject classSubject,
        Teacher teacher
) {
}
