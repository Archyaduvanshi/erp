package com.erp.backend.examination.dto;

import java.util.List;

public record TeacherExamPortalResponse(
        Long teacherId,
        List<ExamOptionClassResponse> assignedClasses,
        List<ExamDateSheetResponse> dateSheets,
        List<ExamQuestionPaperResponse> questionPapers
) {
}
