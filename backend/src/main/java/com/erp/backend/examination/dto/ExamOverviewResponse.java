package com.erp.backend.examination.dto;

import java.time.LocalDate;

public record ExamOverviewResponse(
        long totalExams,
        long upcomingExams,
        long publishedDateSheets,
        long questionPapersUploaded,
        long admitCardsGenerated,
        LocalDate nextExamDate
) {
}
