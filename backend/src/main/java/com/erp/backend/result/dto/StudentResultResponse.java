package com.erp.backend.result.dto;

import java.util.List;

public record StudentResultResponse(
        ResultStudentResponse student,
        List<String> subjects,
        List<ResultExamColumnResponse> exams,
        List<ResultCellResponse> cells,
        List<ResultSummaryResponse> summaries
) {
}
