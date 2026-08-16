package com.erp.backend.examination.service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.erp.backend.examination.dto.ExamAdmitCardPayload;
import com.erp.backend.examination.dto.ExamAdmitCardResponse;
import com.erp.backend.examination.dto.ExamDateSheetPayload;
import com.erp.backend.examination.dto.ExamDateSheetResponse;
import com.erp.backend.examination.dto.ExamQuestionPaperPayload;
import com.erp.backend.examination.dto.ExamQuestionPaperResponse;
import com.erp.backend.examination.entity.ExamAdmitCard;
import com.erp.backend.examination.entity.ExamDateSheet;
import com.erp.backend.examination.entity.ExamQuestionPaper;
import com.erp.backend.examination.repository.ExamAdmitCardRepository;
import com.erp.backend.examination.repository.ExamDateSheetRepository;
import com.erp.backend.examination.repository.ExamQuestionPaperRepository;
import com.erp.backend.exception.FieldValidationException;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ExaminationService {
    private final InstituteRepository instituteRepository;
    private final ExamDateSheetRepository examDateSheetRepository;
    private final ExamQuestionPaperRepository examQuestionPaperRepository;
    private final ExamAdmitCardRepository examAdmitCardRepository;
    private final ObjectMapper objectMapper;

    public ExaminationService(
            InstituteRepository instituteRepository,
            ExamDateSheetRepository examDateSheetRepository,
            ExamQuestionPaperRepository examQuestionPaperRepository,
            ExamAdmitCardRepository examAdmitCardRepository,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.examDateSheetRepository = examDateSheetRepository;
        this.examQuestionPaperRepository = examQuestionPaperRepository;
        this.examAdmitCardRepository = examAdmitCardRepository;
        this.objectMapper = objectMapper;
    }

    public List<ExamDateSheetResponse> getDateSheets(Long instituteId) {
        validateInstitute(instituteId);
        return examDateSheetRepository.findAllByInstituteIdOrderByClassNameAsc(instituteId)
                .stream()
                .sorted(Comparator.comparing(ExamDateSheet::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ExamDateSheet::getExamType, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toDateSheetResponse)
                .toList();
    }

    @Transactional
    public ExamDateSheetResponse saveDateSheet(Long instituteId, ExamDateSheetPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateDateSheetPayload(request);
        ExamDateSheet dateSheet = examDateSheetRepository
                .findByInstituteIdAndClassNameIgnoreCase(instituteId, request.className().trim())
                .orElseGet(ExamDateSheet::new);

        if (dateSheet.getId() == null) {
            dateSheet.setInstitute(institute);
        }

        applyDateSheetPayload(dateSheet, request);
        return toDateSheetResponse(examDateSheetRepository.save(dateSheet));
    }

    @Transactional
    public void deleteDateSheet(Long instituteId, Long id) {
        ExamDateSheet dateSheet = examDateSheetRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam date sheet not found with id: " + id));
        examDateSheetRepository.delete(dateSheet);
    }

    public List<ExamQuestionPaperResponse> getQuestionPapers(Long instituteId) {
        validateInstitute(instituteId);
        return examQuestionPaperRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing(ExamQuestionPaper::getExamTitle, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ExamQuestionPaper::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(ExamQuestionPaper::getSubjectName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toQuestionPaperResponse)
                .toList();
    }

    @Transactional
    public ExamQuestionPaperResponse saveQuestionPaper(Long instituteId, ExamQuestionPaperPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateQuestionPaperPayload(request);
        ExamQuestionPaper questionPaper = new ExamQuestionPaper();
        questionPaper.setInstitute(institute);
        applyQuestionPaperPayload(questionPaper, request);
        return toQuestionPaperResponse(examQuestionPaperRepository.save(questionPaper));
    }

    @Transactional
    public void deleteQuestionPaper(Long instituteId, Long id) {
        ExamQuestionPaper questionPaper = examQuestionPaperRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam question paper not found with id: " + id));
        examQuestionPaperRepository.delete(questionPaper);
    }

    public List<ExamAdmitCardResponse> getAdmitCards(Long instituteId) {
        validateInstitute(instituteId);
        return examAdmitCardRepository.findAllByInstituteIdOrderByExamDateAscCreatedAtDesc(instituteId)
                .stream()
                .map(this::toAdmitCardResponse)
                .toList();
    }

    @Transactional
    public ExamAdmitCardResponse saveAdmitCard(Long instituteId, ExamAdmitCardPayload request) {
        Institute institute = validateInstitute(instituteId);
        validateAdmitCardPayload(request);
        ExamAdmitCard admitCard = new ExamAdmitCard();
        admitCard.setInstitute(institute);
        applyAdmitCardPayload(admitCard, request);
        return toAdmitCardResponse(examAdmitCardRepository.save(admitCard));
    }

    @Transactional
    public void deleteAdmitCard(Long instituteId, Long id) {
        ExamAdmitCard admitCard = examAdmitCardRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam admit card not found with id: " + id));
        examAdmitCardRepository.delete(admitCard);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void validateDateSheetPayload(ExamDateSheetPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        int shiftCount = parsePositiveInteger(request.shiftsPerDay(), "shiftsPerDay", "Shifts per day must be a valid number.", errors);
        parsePositiveNumber(request.shiftDurationHours(), "shiftDurationHours", "Shift duration must be greater than 0.", errors);

        if (StringUtils.hasText(request.shiftDurationUnit()) && !List.of("hours", "minutes").contains(request.shiftDurationUnit().trim())) {
            errors.put("shiftDurationUnit", "Shift duration unit must be hours or minutes.");
        }

        if (request.shiftStartTimes() == null || request.shiftStartTimes().isEmpty()) {
            errors.put("shiftStartTimes", "Shift start time is required.");
        } else if (shiftCount > 0 && request.shiftStartTimes().size() != shiftCount) {
            errors.put("shiftStartTimes", "Shift start time must be selected for every shift.");
        } else if (request.shiftStartTimes().stream().anyMatch(value -> !StringUtils.hasText(value))) {
            errors.put("shiftStartTimes", "Shift start time must be selected for every shift.");
        }

        LocalDate startDate = parseDate(request.examStartDate(), "examStartDate", "Exam start date must be valid.", errors);
        LocalDate endDate = parseDate(request.examEndDate(), "examEndDate", "Exam end date must be valid.", errors);
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            errors.put("examEndDate", "Exam end date cannot be before start date.");
        }

        throwIfFieldErrors(errors);
    }

    private void validateQuestionPaperPayload(ExamQuestionPaperPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (!StringUtils.hasText(request.fileType())) {
            errors.put("fileType", "File type is required.");
        }
        throwIfFieldErrors(errors);
    }

    private void validateAdmitCardPayload(ExamAdmitCardPayload request) {
        Map<String, String> errors = new LinkedHashMap<>();
        parseDate(request.examDate(), "examDate", "Exam date must be valid.", errors);
        throwIfFieldErrors(errors);
    }

    private void applyDateSheetPayload(ExamDateSheet dateSheet, ExamDateSheetPayload request) {
        dateSheet.setClassName(request.className().trim());
        dateSheet.setClassFrom(trim(request.classFrom()));
        dateSheet.setClassTo(trim(request.classTo()));
        dateSheet.setSectionWise(Boolean.TRUE.equals(request.sectionWise()));
        dateSheet.setExamType(request.examType().trim());
        dateSheet.setShiftsPerDay(trim(request.shiftsPerDay()));
        dateSheet.setShiftStartTimesJson(writeJson(request.shiftStartTimes() == null ? List.of() : request.shiftStartTimes()));
        dateSheet.setShiftDurationHours(trim(request.shiftDurationHours()));
        dateSheet.setShiftDurationUnit(trim(request.shiftDurationUnit()));
        dateSheet.setExamStartDate(trim(request.examStartDate()));
        dateSheet.setExamEndDate(trim(request.examEndDate()));
        dateSheet.setFileName(request.fileName().trim());
        dateSheet.setFileData(request.fileData().trim());
        dateSheet.setFileType(trim(request.fileType()));
    }

    private void applyQuestionPaperPayload(ExamQuestionPaper questionPaper, ExamQuestionPaperPayload request) {
        questionPaper.setExamTitle(request.examTitle().trim());
        questionPaper.setClassName(request.className().trim());
        questionPaper.setSubjectName(request.subjectName().trim());
        questionPaper.setUploadedBy(trim(request.uploadedBy()));
        questionPaper.setFileName(request.fileName().trim());
        questionPaper.setFileData(request.fileData().trim());
        questionPaper.setFileType(trim(request.fileType()));
    }

    private void applyAdmitCardPayload(ExamAdmitCard admitCard, ExamAdmitCardPayload request) {
        admitCard.setExamTitle(request.examTitle().trim());
        admitCard.setStudentId(request.studentId().trim());
        admitCard.setStudentName(trim(request.studentName()));
        admitCard.setRollNo(trim(request.rollNo()));
        admitCard.setClassName(trim(request.className()));
        admitCard.setCenterName(request.centerName().trim());
        admitCard.setReportingTime(request.reportingTime().trim());
        admitCard.setExamDate(request.examDate().trim());
    }

    private ExamDateSheetResponse toDateSheetResponse(ExamDateSheet dateSheet) {
        return new ExamDateSheetResponse(
                dateSheet.getId(),
                dateSheet.getClassName(),
                dateSheet.getClassFrom(),
                dateSheet.getClassTo(),
                Boolean.TRUE.equals(dateSheet.getSectionWise()),
                dateSheet.getExamType(),
                dateSheet.getShiftsPerDay(),
                readStringList(dateSheet.getShiftStartTimesJson()),
                dateSheet.getShiftDurationHours(),
                dateSheet.getShiftDurationUnit(),
                dateSheet.getExamStartDate(),
                dateSheet.getExamEndDate(),
                dateSheet.getFileName(),
                dateSheet.getFileData(),
                dateSheet.getFileType(),
                dateSheet.getCreatedAt(),
                dateSheet.getUpdatedAt()
        );
    }

    private ExamQuestionPaperResponse toQuestionPaperResponse(ExamQuestionPaper questionPaper) {
        return new ExamQuestionPaperResponse(
                questionPaper.getId(),
                questionPaper.getExamTitle(),
                questionPaper.getClassName(),
                questionPaper.getSubjectName(),
                questionPaper.getUploadedBy(),
                questionPaper.getFileName(),
                questionPaper.getFileData(),
                questionPaper.getFileType(),
                questionPaper.getCreatedAt(),
                questionPaper.getUpdatedAt()
        );
    }

    private ExamAdmitCardResponse toAdmitCardResponse(ExamAdmitCard admitCard) {
        return new ExamAdmitCardResponse(
                admitCard.getId(),
                admitCard.getExamTitle(),
                admitCard.getStudentId(),
                admitCard.getStudentName(),
                admitCard.getRollNo(),
                admitCard.getClassName(),
                admitCard.getCenterName(),
                admitCard.getReportingTime(),
                admitCard.getExamDate(),
                admitCard.getCreatedAt(),
                admitCard.getUpdatedAt()
        );
    }

    private int parsePositiveInteger(String value, String fieldName, String message, Map<String, String> errors) {
        if (!StringUtils.hasText(value)) {
            return 0;
        }
        try {
            int parsedValue = Integer.parseInt(value.trim());
            if (parsedValue <= 0) {
                errors.put(fieldName, message);
                return 0;
            }
            return parsedValue;
        } catch (NumberFormatException exception) {
            errors.put(fieldName, message);
            return 0;
        }
    }

    private void parsePositiveNumber(String value, String fieldName, String message, Map<String, String> errors) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        try {
            double parsedValue = Double.parseDouble(value.trim());
            if (parsedValue <= 0) {
                errors.put(fieldName, message);
            }
        } catch (NumberFormatException exception) {
            errors.put(fieldName, message);
        }
    }

    private LocalDate parseDate(String value, String fieldName, String message, Map<String, String> errors) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException exception) {
            errors.put(fieldName, message);
            return null;
        }
    }

    private void throwIfFieldErrors(Map<String, String> errors) {
        if (!errors.isEmpty()) {
            throw new FieldValidationException("Please fix the highlighted examination fields.", errors);
        }
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to save examination JSON data.", exception);
        }
    }

    private List<String> readStringList(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of();
        }

        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() {
            });
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read examination JSON data.", exception);
        }
    }
}
