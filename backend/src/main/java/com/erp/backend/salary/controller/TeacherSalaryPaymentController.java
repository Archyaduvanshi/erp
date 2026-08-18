package com.erp.backend.salary.controller;

import java.util.List;

import com.erp.backend.salary.dto.TeacherSalaryPaymentPayload;
import com.erp.backend.salary.dto.TeacherSalaryPaymentResponse;
import com.erp.backend.salary.service.TeacherSalaryPaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/salary/payments")
public class TeacherSalaryPaymentController {

    private final TeacherSalaryPaymentService salaryPaymentService;

    public TeacherSalaryPaymentController(TeacherSalaryPaymentService salaryPaymentService) {
        this.salaryPaymentService = salaryPaymentService;
    }

    @GetMapping
    public List<TeacherSalaryPaymentResponse> getPayments(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestParam(required = false) Long teacherId
    ) {
        return salaryPaymentService.getPayments(instituteId, teacherId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeacherSalaryPaymentResponse savePayment(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody TeacherSalaryPaymentPayload request
    ) {
        return salaryPaymentService.savePayment(instituteId, request);
    }
}
