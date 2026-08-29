package com.erp.backend.course.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.course.dto.CourseBookPayload;
import com.erp.backend.course.dto.CourseBookResponse;
import com.erp.backend.course.service.CourseBookService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/course-books")
public class CourseBookController {

    private final CourseBookService courseBookService;

    public CourseBookController(CourseBookService courseBookService) {
        this.courseBookService = courseBookService;
    }

    @GetMapping
    public List<CourseBookResponse> getCourseBooks(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return courseBookService.getCourseBooks(instituteId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseBookResponse saveCourseBook(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody CourseBookPayload request
    ) {
        return courseBookService.saveCourseBook(instituteId, request);
    }

    @PutMapping("/{id}")
    public CourseBookResponse updateCourseBook(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id,
            @Valid @RequestBody CourseBookPayload request
    ) {
        return courseBookService.updateCourseBook(instituteId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCourseBook(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long id
    ) {
        courseBookService.deleteCourseBook(instituteId, id);
    }
}
