package com.erp.backend.cashbook.dto;

import jakarta.validation.constraints.NotBlank;

public record CashbookVoidPayload(@NotBlank String reason) {
}
