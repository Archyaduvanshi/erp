package com.erp.backend.library.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LibraryBookPayload(
        @NotBlank(message = "ISBN is required.")
        String isbn,
        @NotBlank(message = "Title is required.")
        String title,
        @NotBlank(message = "Author is required.")
        String author,
        @NotBlank(message = "Format is required.")
        String format,
        @NotBlank(message = "Shelf location is required.")
        String shelfLocation,
        @NotNull(message = "Available quantity is required.")
        @Min(value = 0, message = "Available quantity cannot be negative.")
        Integer availableQuantity
) {
}
