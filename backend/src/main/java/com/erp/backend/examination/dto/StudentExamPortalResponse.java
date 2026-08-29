package com.erp.backend.examination.dto;

import java.util.List;

public record StudentExamPortalResponse(
        Long studentId,
        String studentName,
        String className,
        List<ExamDateSheetResponse> dateSheets,
        List<ExamQuestionPaperResponse> questionPapers,
        List<ExamAdmitCardResponse> admitCards
) {
}
