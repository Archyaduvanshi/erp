package com.erp.backend.student.controller;

import java.util.List;

import com.erp.backend.student.dto.StudentPayload;
import com.erp.backend.student.dto.StudentPortalLoginRequest;
import com.erp.backend.student.dto.StudentPortalLoginResponse;
import com.erp.backend.student.dto.StudentResponse;
import com.erp.backend.student.dto.UpdateStudentFacilitiesRequest;
import com.erp.backend.student.service.StudentService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @PostMapping(value = "/portal-login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public StudentPortalLoginResponse loginStudent(@Valid @RequestBody StudentPortalLoginRequest request) {
        return studentService.loginStudent(request);
    }

    @GetMapping
    public List<StudentResponse> getAllStudents(@RequestHeader("X-Institute-Id") Long instituteId) {
        return studentService.getAllStudents(instituteId);
    }

    @GetMapping("/{id}")
    public StudentResponse getStudentById(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        return studentService.getStudentById(instituteId, id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse createStudent(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody StudentPayload request
    ) {
        return studentService.createStudent(instituteId, request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public StudentResponse updateStudent(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody StudentPayload request
    ) {
        return studentService.updateStudent(instituteId, id, request);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<StudentResponse> importStudents(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestBody List<StudentPayload> students
    ) {
        return studentService.importStudents(instituteId, students);
    }

    @PatchMapping(value = "/{id}/facilities", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public StudentResponse updateFacilities(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id,
            @RequestBody UpdateStudentFacilitiesRequest request
    ) {
        return studentService.updateFacilities(instituteId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStudent(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        studentService.deleteStudent(instituteId, id);
    }
}
