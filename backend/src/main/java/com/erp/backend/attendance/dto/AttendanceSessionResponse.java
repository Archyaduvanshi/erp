package com.erp.backend.attendance.dto;

import java.util.List;

public record AttendanceSessionResponse(
        Long sessionId,
        Long academicSessionId,
        Long classId,
        Long sectionId,
        String attendanceDate,
        Integer periodNumber,
        Long classSubjectId,
        String subjectName,
        Long markedByTeacherId,
        String markedByTeacherName,
        List<AttendanceSessionEntryResponse> entries
) {
}
