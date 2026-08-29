package com.erp.backend.library.dto;

import jakarta.validation.constraints.NotNull;

public record LibraryIssuePayload(
        @NotNull(message = "Book is required.")
        Long bookId,
        @NotNull(message = "Borrower is required.")
        Long borrowerId,
        String issueDate,
        String dueDate,
        String returnDate,
        String finePerDay,
        String damageCharges
) {
}
