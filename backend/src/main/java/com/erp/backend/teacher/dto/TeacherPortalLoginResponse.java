package com.erp.backend.teacher.dto;

public record TeacherPortalLoginResponse(
        Long instituteId,
        String instituteName,
        String instituteUsername,
        String instituteType,
        String instituteLogo,
        Long teacherId,
        String teacherSystemId,
        String employeeId,
        String teacherName
) {
}
