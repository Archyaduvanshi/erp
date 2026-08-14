package com.erp.backend.holiday.controller;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
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
    public List<HolidayResponse> getHolidays(@RequestHeader("X-Institute-Id") Long instituteId) {
        return holidayService.getHolidays(instituteId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HolidayResponse createHoliday(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody HolidayPayload request
    ) {
        return holidayService.createHoliday(instituteId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHoliday(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        holidayService.deleteHoliday(instituteId, id);
    }
}
