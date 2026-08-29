package com.erp.backend.holiday.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.holiday.dto.HolidayPayload;
import com.erp.backend.holiday.dto.HolidayResponse;
import com.erp.backend.holiday.service.HolidayService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/holidays")
public class HolidayController {

    private final HolidayService holidayService;

    public HolidayController(HolidayService holidayService) {
        this.holidayService = holidayService;
    }

    @GetMapping
    public List<HolidayResponse> getHolidays(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        return holidayService.getHolidays(instituteId, from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HolidayResponse createHoliday(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody HolidayPayload request
    ) {
        return holidayService.createHoliday(instituteId, request);
    }

    @PutMapping("/{id}")
    public HolidayResponse updateHoliday(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody HolidayPayload request
    ) {
        return holidayService.updateHoliday(instituteId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHoliday(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        holidayService.deleteHoliday(instituteId, id);
    }
}
