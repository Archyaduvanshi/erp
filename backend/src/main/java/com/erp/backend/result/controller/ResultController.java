package com.erp.backend.result.controller;

import java.util.List;

import com.erp.backend.result.dto.ResultClassResponse;
import com.erp.backend.result.dto.ResultStudentResponse;
import com.erp.backend.result.dto.StudentResultResponse;
import com.erp.backend.result.service.ResultService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/results")
public class ResultController {

    private final ResultService resultService;

    public ResultController(ResultService resultService) {
        this.resultService = resultService;
    }

    @GetMapping("/classes")
    public List<ResultClassResponse> getClasses(@RequestHeader("X-Institute-Id") Long instituteId) {
        return resultService.getClasses(instituteId);
    }

    @GetMapping("/students")
    public List<ResultStudentResponse> getClassStudents(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestParam String className
    ) {
        return resultService.getClassStudents(instituteId, className);
    }

    @GetMapping("/student")
    public StudentResultResponse getStudentResult(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestParam String className,
            @RequestParam Long studentId
    ) {
        return resultService.getStudentResult(instituteId, className, studentId);
    }
}
