package com.erp.backend.library.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LibraryBookPayload(
        @NotBlank(message = "ISBN is required.")
        @Pattern(regexp = "^[A-Z0-9-]{3,24}$", message = "ISBN must contain 3-24 uppercase letters, numbers, or hyphens.")
        String isbn,
        @NotBlank(message = "Title is required.")
        @Size(min = 2, max = 160, message = "Title must contain 2-160 characters.")
        String title,
        @NotBlank(message = "Author is required.")
        @Pattern(regexp = "^[A-Z .'-]{2,80}$", message = "Author name can contain letters, spaces, dots, hyphens, or apostrophes.")
        String author,
        @NotBlank(message = "Format is required.")
        @Pattern(regexp = "^(Physical|Digital)$", message = "Format must be Physical or Digital.")
        String format,
        @NotBlank(message = "Shelf location is required.")
        @Pattern(regexp = "^[A-Z0-9 /-]{3,80}$", message = "Shelf location must contain rack and shelf details.")
        String shelfLocation,
        @NotNull(message = "Available quantity is required.")
        @Min(value = 1, message = "Available quantity must be at least 1.")
        Integer availableQuantity
) {
}
