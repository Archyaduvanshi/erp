package com.erp.backend.library.dto;

import java.time.LocalDateTime;

public record LibraryIssueResponse(
        Long id,
        Long bookId,
        String bookTitle,
        Long borrowerId,
        String borrowerName,
        String borrowerMeta,
        String issueDate,
        String dueDate,
        String returnDate,
        String finePerDay,
        String damageCharges,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
