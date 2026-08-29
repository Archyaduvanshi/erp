package com.erp.backend.attendance.dto;

public record AttendanceTargetResponse(
        Long classId,
        String className,
        Long sectionId,
        String sectionName,
        String displayName,
        long studentCount
) {
}
