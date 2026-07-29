package com.erp.backend.library.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LibraryIssuePayload(
        @NotNull(message = "Book is required.")
        Long bookId,
        @NotNull(message = "Borrower is required.")
        Long borrowerId,
        @NotBlank(message = "Issue date is required.")
        String issueDate,
        @NotBlank(message = "Due date is required.")
        String dueDate,
        String returnDate,
        String finePerDay,
        String damageCharges
) {
}
