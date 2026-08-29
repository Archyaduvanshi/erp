package com.erp.backend.curriculum.dto;

public record ClassSubjectResponse(
        Long classSubjectId,
        Long classId,
        String className,
        Long subjectId,
        String subjectName,
        String subjectCode,
        String subjectType,
        Integer displayOrder,
        String status,
        String notes,
        Long bookCount
) {
}
