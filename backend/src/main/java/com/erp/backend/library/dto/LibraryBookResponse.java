package com.erp.backend.library.dto;

import java.time.LocalDateTime;

public record LibraryBookResponse(
        Long id,
        String isbn,
        String title,
        String author,
        String format,
        String shelfLocation,
        Integer availableQuantity,
        Integer totalCopies,
        Integer availableCopies,
        Integer issuedCopies,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
