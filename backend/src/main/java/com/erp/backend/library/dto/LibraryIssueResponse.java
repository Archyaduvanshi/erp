package com.erp.backend.library.dto;

import java.time.LocalDateTime;

public record LibraryIssueResponse(
        Long id,
        Long bookId,
        String bookTitle,
        String isbn,
        Long borrowerId,
        String borrowerName,
        String borrowerMeta,
        String borrowerClass,
        String sectionName,
        String issueDate,
        String dueDate,
        String returnDate,
        String status,
        Long overdueDays,
        String finePerDay,
        String lateFine,
        String damageCharges,
        String totalFine,
        String bookAuthor,
        String shelfLocation,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
