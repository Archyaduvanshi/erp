package com.erp.backend.timetable.dto;

import java.util.List;

public record TeacherTimetableResponse(
        Long teacherId,
        List<TimetablePeriodResponse> week
) {
}
