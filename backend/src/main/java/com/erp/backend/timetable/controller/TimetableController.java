package com.erp.backend.timetable.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.timetable.dto.ClassTimetablePayload;
import com.erp.backend.timetable.dto.ClassTimetableResponse;
import com.erp.backend.timetable.dto.TeacherOccupancyResponse;
import com.erp.backend.timetable.dto.TeacherTimetableResponse;
import com.erp.backend.timetable.dto.TimetableClassSummaryResponse;
import com.erp.backend.timetable.dto.TimetableTemplateDraftPayload;
import com.erp.backend.timetable.dto.TimetableTemplateDraftResponse;
import com.erp.backend.timetable.service.TimetableService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
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
    public List<ClassTimetableResponse> getClassTimetables(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return timetableService.getClassTimetables(instituteId);
    }

    @GetMapping
    public List<TimetableClassSummaryResponse> getTimetableSummaries(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return timetableService.getTimetableSummaries(instituteId, academicSessionId);
    }

    @GetMapping("/teacher-occupancy")
    public TeacherOccupancyResponse getTeacherOccupancy(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return timetableService.getTeacherOccupancy(instituteId, academicSessionId);
    }

    @GetMapping("/teachers/{teacherId}")
    public TeacherTimetableResponse getTeacherTimetable(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long teacherId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return timetableService.getTeacherTimetable(instituteId, teacherId, academicSessionId);
    }

    @GetMapping("/students/{studentId}")
    public ResponseEntity<ClassTimetableResponse> getStudentTimetable(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long studentId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        ClassTimetableResponse response = timetableService.getStudentTimetable(instituteId, studentId, academicSessionId);
        return response == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(response);
    }

    @GetMapping("/classes/{classId}")
    public ResponseEntity<ClassTimetableResponse> getClassTimetable(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long sectionId
    ) {
        ClassTimetableResponse response = timetableService.getClassTimetable(instituteId, classId, academicSessionId, sectionId);
        return response == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(response);
    }

    @GetMapping("/classes/{classId}/draft")
    public ResponseEntity<TimetableTemplateDraftResponse> getTemplateDraft(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long sectionId
    ) {
        TimetableTemplateDraftResponse response = timetableService.getTemplateDraft(instituteId, classId, academicSessionId, sectionId);
        return response == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(response);
    }

    @PostMapping(value = "/classes/{classId}/draft", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TimetableTemplateDraftResponse saveTemplateDraft(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long sectionId,
            @Valid @RequestBody TimetableTemplateDraftPayload request
    ) {
        return timetableService.saveTemplateDraft(instituteId, classId, academicSessionId, sectionId, request);
    }

    @PostMapping(value = "/classes/{classId}/publish", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ClassTimetableResponse publishClassTimetable(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @Valid @RequestBody ClassTimetablePayload request
    ) {
        return timetableService.publishClassTimetable(instituteId, classId, request);
    }

    @PostMapping(value = "/classes", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ClassTimetableResponse saveClassTimetable(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ClassTimetablePayload request
    ) {
        return timetableService.saveClassTimetable(instituteId, request);
    }

    @DeleteMapping("/classes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteClassTimetable(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        timetableService.deleteClassTimetable(instituteId, id);
    }

    @GetMapping("/template-drafts")
    public List<TimetableTemplateDraftResponse> getTemplateDrafts(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return timetableService.getTemplateDrafts(instituteId);
    }

    @PostMapping(value = "/template-drafts", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TimetableTemplateDraftResponse saveTemplateDraft(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody TimetableTemplateDraftPayload request
    ) {
        return timetableService.saveTemplateDraft(instituteId, request);
    }

    @DeleteMapping("/template-drafts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplateDraft(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        timetableService.deleteTemplateDraft(instituteId, id);
    }
}
