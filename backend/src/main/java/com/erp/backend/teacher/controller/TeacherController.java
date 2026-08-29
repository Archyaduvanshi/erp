package com.erp.backend.teacher.controller;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.teacher.dto.TeacherPayload;
import com.erp.backend.teacher.dto.TeacherOptionResponse;
import com.erp.backend.teacher.dto.TeacherPortalLoginRequest;
import com.erp.backend.teacher.dto.TeacherPortalLoginResponse;
import com.erp.backend.teacher.dto.TeacherResponse;
import com.erp.backend.teacher.service.TeacherService;
import com.erp.backend.timetable.dto.TeacherTimetableResponse;
import com.erp.backend.timetable.service.TimetableService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teachers")
public class TeacherController {

    private final TeacherService teacherService;
    private final TimetableService timetableService;

    public TeacherController(TeacherService teacherService, TimetableService timetableService) {
        this.teacherService = teacherService;
        this.timetableService = timetableService;
    }

    @PostMapping(value = "/portal-login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TeacherPortalLoginResponse loginTeacher(@Valid @RequestBody TeacherPortalLoginRequest request) {
        return teacherService.loginTeacher(request);
    }

    @GetMapping
    public Object getTeachers(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String specialization,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String designation,
            @RequestParam(required = false) String contractType,
            @RequestParam(required = false) String sort
    ) {
        if (page == null
                && size == null
                && search == null
                && status == null
                && specialization == null
                && department == null
                && designation == null
                && contractType == null
                && sort == null) {
            return teacherService.getAllTeachers(instituteId);
        }

        return teacherService.getTeachersPage(instituteId, page, size, search, status, specialization, contractType, sort);
    }

    @GetMapping("/options")
    public List<TeacherOptionResponse> getTeacherOptions(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false, defaultValue = "Active") String status
    ) {
        return teacherService.getTeacherOptions(instituteId, status);
    }

    @GetMapping("/me/timetable")
    public TeacherTimetableResponse getMyTimetable(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return timetableService.getTeacherTimetable(principal.instituteId(), principal.teacherId(), academicSessionId);
    }

    @GetMapping("/{id}")
    public TeacherResponse getTeacherById(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        return teacherService.getTeacherById(instituteId, id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TeacherResponse createTeacher(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody TeacherPayload request
    ) {
        return teacherService.createTeacher(instituteId, request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TeacherResponse updateTeacher(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody TeacherPayload request
    ) {
        return teacherService.updateTeacher(instituteId, id, request);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<TeacherResponse> importTeachers(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestBody List<TeacherPayload> teachers
    ) {
        return teacherService.importTeachers(instituteId, teachers);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTeacher(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        teacherService.deleteTeacher(instituteId, id);
    }
}
