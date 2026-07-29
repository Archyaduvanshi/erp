package com.erp.backend.examination.service;

import java.util.Comparator;
import java.util.List;

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

    private void applyDateSheetPayload(ExamDateSheet dateSheet, ExamDateSheetPayload request) {
        dateSheet.setClassName(request.className().trim());
        dateSheet.setClassFrom(trim(request.classFrom()));
        dateSheet.setClassTo(trim(request.classTo()));
        dateSheet.setSectionWise(Boolean.TRUE.equals(request.sectionWise()));
        dateSheet.setExamType(request.examType().trim());
        dateSheet.setShiftsPerDay(trim(request.shiftsPerDay()));
        dateSheet.setShiftStartTimesJson(writeJson(request.shiftStartTimes() == null ? List.of() : request.shiftStartTimes()));
        dateSheet.setShiftDurationHours(trim(request.shiftDurationHours()));
        dateSheet.setShiftDurationUnit(defaultValue(request.shiftDurationUnit(), "hours"));
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
                defaultValue(dateSheet.getShiftDurationUnit(), "hours"),
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

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
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
