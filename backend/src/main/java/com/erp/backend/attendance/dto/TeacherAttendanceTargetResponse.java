package com.erp.backend.attendance.dto;

public record TeacherAttendanceTargetResponse(
        Long classId,
        String className,
        Long sectionId,
        String sectionName,
        String displayName,
        long studentCount
) {
}
