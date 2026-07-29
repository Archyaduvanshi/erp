package com.erp.backend.timetable.controller;

import java.util.List;

import com.erp.backend.timetable.dto.ClassTimetablePayload;
import com.erp.backend.timetable.dto.ClassTimetableResponse;
import com.erp.backend.timetable.dto.TimetableTemplateDraftPayload;
import com.erp.backend.timetable.dto.TimetableTemplateDraftResponse;
import com.erp.backend.timetable.service.TimetableService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
@RequestMapping("/api/timetables")
public class TimetableController {
    private final TimetableService timetableService;

    public TimetableController(TimetableService timetableService) {
        this.timetableService = timetableService;
    }

    @GetMapping("/classes")
    public List<ClassTimetableResponse> getClassTimetables(@RequestHeader("X-Institute-Id") Long instituteId) {
        return timetableService.getClassTimetables(instituteId);
    }

    @PostMapping(value = "/classes", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ClassTimetableResponse saveClassTimetable(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody ClassTimetablePayload request
    ) {
        return timetableService.saveClassTimetable(instituteId, request);
    }

    @DeleteMapping("/classes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteClassTimetable(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        timetableService.deleteClassTimetable(instituteId, id);
    }

    @GetMapping("/template-drafts")
    public List<TimetableTemplateDraftResponse> getTemplateDrafts(@RequestHeader("X-Institute-Id") Long instituteId) {
        return timetableService.getTemplateDrafts(instituteId);
    }

    @PostMapping(value = "/template-drafts", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TimetableTemplateDraftResponse saveTemplateDraft(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody TimetableTemplateDraftPayload request
    ) {
        return timetableService.saveTemplateDraft(instituteId, request);
    }

    @DeleteMapping("/template-drafts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplateDraft(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        timetableService.deleteTemplateDraft(instituteId, id);
    }
}
