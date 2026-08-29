package com.erp.backend.timetable.dto;

import java.util.List;
import java.util.Map;

public record TeacherOccupancyResponse(
        Map<Long, List<TimetablePeriodResponse>> teachers
) {
}
