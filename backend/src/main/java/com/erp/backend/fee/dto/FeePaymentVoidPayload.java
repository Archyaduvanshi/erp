package com.erp.backend.fee.dto;

import jakarta.validation.constraints.NotBlank;

public record FeePaymentVoidPayload(
        @NotBlank String reason
) {
}
