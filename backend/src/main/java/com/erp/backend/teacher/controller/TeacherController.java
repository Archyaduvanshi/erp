package com.erp.backend.teacher.controller;

import java.util.List;

import com.erp.backend.teacher.dto.TeacherPayload;
import com.erp.backend.teacher.dto.TeacherPortalLoginRequest;
import com.erp.backend.teacher.dto.TeacherPortalLoginResponse;
import com.erp.backend.teacher.dto.TeacherResponse;
import com.erp.backend.teacher.service.TeacherService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teachers")
public class TeacherController {

    private final TeacherService teacherService;

    public TeacherController(TeacherService teacherService) {
        this.teacherService = teacherService;
    }

    @PostMapping(value = "/portal-login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TeacherPortalLoginResponse loginTeacher(@Valid @RequestBody TeacherPortalLoginRequest request) {
        return teacherService.loginTeacher(request);
    }

    @GetMapping
    public List<TeacherResponse> getAllTeachers(@RequestHeader("X-Institute-Id") Long instituteId) {
        return teacherService.getAllTeachers(instituteId);
    }

    @GetMapping("/{id}")
    public TeacherResponse getTeacherById(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        return teacherService.getTeacherById(instituteId, id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public TeacherResponse createTeacher(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody TeacherPayload request
    ) {
        return teacherService.createTeacher(instituteId, request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public TeacherResponse updateTeacher(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody TeacherPayload request
    ) {
        return teacherService.updateTeacher(instituteId, id, request);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<TeacherResponse> importTeachers(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestBody List<TeacherPayload> teachers
    ) {
        return teacherService.importTeachers(instituteId, teachers);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTeacher(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        teacherService.deleteTeacher(instituteId, id);
    }
}
