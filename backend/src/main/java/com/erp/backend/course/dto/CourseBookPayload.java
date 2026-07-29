package com.erp.backend.course.dto;

import jakarta.validation.constraints.NotBlank;

public record CourseBookPayload(
        @NotBlank(message = "Class name is required") String className,
        @NotBlank(message = "Subject name is required") String subjectName,
        @NotBlank(message = "Publisher is required") String publisher,
        String language,
        String academicYear,
        String notes
) {
}
