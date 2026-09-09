package com.erp.backend.student.controller;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.student.dto.StudentClassSummaryResponse;
import com.erp.backend.student.dto.StudentPayload;
import com.erp.backend.student.dto.StudentPortalLoginRequest;
import com.erp.backend.student.dto.StudentPortalLoginResponse;
import com.erp.backend.student.dto.StudentResponse;
import com.erp.backend.student.dto.UpdateStudentFacilitiesRequest;
import com.erp.backend.student.service.StudentService;
import com.erp.backend.timetable.dto.ClassTimetableResponse;
import com.erp.backend.timetable.service.TimetableService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;
    private final TimetableService timetableService;

    public StudentController(StudentService studentService, TimetableService timetableService) {
        this.studentService = studentService;
        this.timetableService = timetableService;
    }

    @PostMapping(value = "/portal-login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public StudentPortalLoginResponse loginStudent(@Valid @RequestBody StudentPortalLoginRequest request) {
        return studentService.loginStudent(request);
    }

    @GetMapping("/class-summary")
    public List<StudentClassSummaryResponse> getClassSummary(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return studentService.getClassSummary(instituteId);
    }

    @GetMapping("/me/timetable")
    public ResponseEntity<ClassTimetableResponse> getMyTimetable(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId
    ) {
        ClassTimetableResponse response = timetableService.getStudentTimetable(principal.instituteId(), principal.studentId(), academicSessionId);
        return response == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(response);
    }

    @GetMapping("/me/dashboard")
    public StudentResponse getMyDashboard(@AuthenticationPrincipal AuthPrincipal principal) {
        return studentService.getStudentById(principal.instituteId(), principal.studentId());
    }

    @GetMapping
    public Object getStudents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String assignedClass,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sort
    ) {
        if (page == null && size == null && assignedClass == null && search == null && status == null && sort == null) {
            return studentService.getAllStudents(instituteId);
        }

        return studentService.getStudentsPage(instituteId, page, size, assignedClass, search, status, sort);
    }

    @GetMapping("/{id}")
    public StudentResponse getStudentById(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        return studentService.getStudentById(instituteId, id);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse createStudent(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody StudentPayload request
    ) {
        return studentService.createStudent(instituteId, request);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public StudentResponse updateStudent(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody StudentPayload request
    ) {
        return studentService.updateStudent(instituteId, id, request);
    }

    @PostMapping(value = "/import", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<StudentResponse> importStudents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestBody List<StudentPayload> students
    ) {
        return studentService.importStudents(instituteId, students);
    }

    @PatchMapping(value = "/{id}/facilities", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public StudentResponse updateFacilities(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @RequestBody UpdateStudentFacilitiesRequest request
    ) {
        return studentService.updateFacilities(instituteId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStudent(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        studentService.deleteStudent(instituteId, id);
    }
}
