package com.erp.backend.fee.controller;

import java.util.List;

import com.erp.backend.fee.dto.FeePaymentPayload;
import com.erp.backend.fee.dto.FeePaymentResponse;
import com.erp.backend.fee.dto.FeeStructurePayload;
import com.erp.backend.fee.dto.FeeStructureResponse;
import com.erp.backend.fee.service.FeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fees")
public class FeeController {

    private final FeeService feeService;

    public FeeController(FeeService feeService) {
        this.feeService = feeService;
    }

    @GetMapping("/classes")
    public List<String> getClasses(@RequestHeader("X-Institute-Id") Long instituteId) {
        return feeService.getClasses(instituteId);
    }

    @GetMapping("/structures")
    public List<FeeStructureResponse> getStructures(@RequestHeader("X-Institute-Id") Long instituteId) {
        return feeService.getStructures(instituteId);
    }

    @PostMapping("/structures")
    @ResponseStatus(HttpStatus.CREATED)
    public FeeStructureResponse saveStructure(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody FeeStructurePayload request
    ) {
        return feeService.saveStructure(instituteId, request);
    }

    @DeleteMapping("/structures/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStructure(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        feeService.deleteStructure(instituteId, id);
    }

    @GetMapping("/payments")
    public List<FeePaymentResponse> getPayments(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestParam(required = false) Long studentId
    ) {
        return feeService.getPayments(instituteId, studentId);
    }

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public FeePaymentResponse savePayment(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody FeePaymentPayload request
    ) {
        return feeService.savePayment(instituteId, request);
    }

    @DeleteMapping("/payments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePayment(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        feeService.deletePayment(instituteId, id);
    }
}
