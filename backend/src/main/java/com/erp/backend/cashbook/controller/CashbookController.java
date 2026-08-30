package com.erp.backend.cashbook.controller;

import java.time.LocalDate;
import java.util.Map;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.cashbook.dto.CashbookEntryPayload;
import com.erp.backend.cashbook.dto.CashbookTransferPayload;
import com.erp.backend.cashbook.dto.CashbookVoidPayload;
import com.erp.backend.cashbook.dto.FinancialAccountPayload;
import com.erp.backend.cashbook.dto.FinancialCategoryPayload;
import com.erp.backend.cashbook.service.CashbookService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cashbook")
public class CashbookController {

    private final CashbookService cashbookService;

    public CashbookController(CashbookService cashbookService) {
        this.cashbookService = cashbookService;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) Long accountId
    ) {
        return cashbookService.overview(principal.instituteId(), academicSessionId, dateFrom, dateTo, accountId);
    }

    @GetMapping("/trend")
    public Object trend(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "month") String groupBy,
            @RequestParam(required = false) Long accountId
    ) {
        return cashbookService.trend(principal.instituteId(), dateFrom, dateTo, groupBy, accountId);
    }

    @GetMapping("/categories/breakdown")
    public Object categoryBreakdown(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "INCOME") String type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) Long accountId
    ) {
        return cashbookService.categoryBreakdown(principal.instituteId(), type, dateFrom, dateTo, accountId);
    }

    @GetMapping("/payment-modes")
    public Object paymentModes(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) Long accountId
    ) {
        return cashbookService.paymentModes(principal.instituteId(), dateFrom, dateTo, accountId);
    }

    @GetMapping("/transactions")
    public Object transactions(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam Map<String, String> filters,
            Pageable pageable
    ) {
        return cashbookService.transactions(principal.instituteId(), filters, pageable);
    }

    @GetMapping("/transactions/export")
    public Object exportTransactions(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam Map<String, String> filters
    ) {
        return cashbookService.transactions(principal.instituteId(), filters, Pageable.ofSize(10000)).getContent();
    }

    @GetMapping("/accounts")
    public Object accounts(@AuthenticationPrincipal AuthPrincipal principal) {
        return cashbookService.accounts(principal.instituteId());
    }

    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    public Object createAccount(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody FinancialAccountPayload request
    ) {
        return cashbookService.createAccount(principal.instituteId(), principal.accountId(), request);
    }

    @GetMapping("/categories")
    public Object categories(@AuthenticationPrincipal AuthPrincipal principal) {
        return cashbookService.categories(principal.instituteId());
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public Object createCategory(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody FinancialCategoryPayload request
    ) {
        return cashbookService.createCategory(principal.instituteId(), request);
    }

    @PostMapping("/income")
    @ResponseStatus(HttpStatus.CREATED)
    public Object addIncome(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody CashbookEntryPayload request
    ) {
        return cashbookService.addIncome(principal.instituteId(), principal.accountId(), request);
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public Object addExpense(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody CashbookEntryPayload request
    ) {
        return cashbookService.addExpense(principal.instituteId(), principal.accountId(), request);
    }

    @PostMapping("/refunds")
    @ResponseStatus(HttpStatus.CREATED)
    public Object addRefund(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody CashbookEntryPayload request
    ) {
        return cashbookService.addRefund(principal.instituteId(), principal.accountId(), request);
    }

    @PostMapping("/transfers")
    @ResponseStatus(HttpStatus.CREATED)
    public Object transfer(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody CashbookTransferPayload request
    ) {
        return cashbookService.transfer(principal.instituteId(), principal.accountId(), request);
    }

    @PostMapping("/entries/{id}/void")
    public Object voidEntry(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody CashbookVoidPayload request
    ) {
        return cashbookService.voidManualEntry(principal.instituteId(), principal.accountId(), id, request.reason());
    }
}
