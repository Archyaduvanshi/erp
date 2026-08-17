package com.erp.backend.settings.entity;

import java.time.LocalDateTime;

import com.erp.backend.institute.entity.Institute;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "college_settings")
public class CollegeSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institute_id", nullable = false, unique = true)
    private Institute institute;

    private String academicYear;
    private String workingDays;
    private String timezone;
    private String language;
    private String dateFormat;
    private String currency;
    private String theme;
    private String studentCodePrefix;
    private String teacherCodePrefix;

    @Column(nullable = false)
    private boolean emailNotice = true;

    @Column(nullable = false)
    private boolean smsAlerts = false;

    @Column(nullable = false)
    private boolean holidayNotice = true;

    @Column(nullable = false)
    private boolean feeReminders = true;

    @Column(nullable = false)
    private boolean attendanceAlerts = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Institute getInstitute() {
        return institute;
    }

    public void setInstitute(Institute institute) {
        this.institute = institute;
    }

    public String getAcademicYear() {
        return academicYear;
    }

    public void setAcademicYear(String academicYear) {
        this.academicYear = academicYear;
    }

    public String getWorkingDays() {
        return workingDays;
    }

    public void setWorkingDays(String workingDays) {
        this.workingDays = workingDays;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getDateFormat() {
        return dateFormat;
    }

    public void setDateFormat(String dateFormat) {
        this.dateFormat = dateFormat;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }

    public String getStudentCodePrefix() {
        return studentCodePrefix;
    }

    public void setStudentCodePrefix(String studentCodePrefix) {
        this.studentCodePrefix = studentCodePrefix;
    }

    public String getTeacherCodePrefix() {
        return teacherCodePrefix;
    }

    public void setTeacherCodePrefix(String teacherCodePrefix) {
        this.teacherCodePrefix = teacherCodePrefix;
    }

    public boolean isEmailNotice() {
        return emailNotice;
    }

    public void setEmailNotice(boolean emailNotice) {
        this.emailNotice = emailNotice;
    }

    public boolean isSmsAlerts() {
        return smsAlerts;
    }

    public void setSmsAlerts(boolean smsAlerts) {
        this.smsAlerts = smsAlerts;
    }

    public boolean isHolidayNotice() {
        return holidayNotice;
    }

    public void setHolidayNotice(boolean holidayNotice) {
        this.holidayNotice = holidayNotice;
    }

    public boolean isFeeReminders() {
        return feeReminders;
    }

    public void setFeeReminders(boolean feeReminders) {
        this.feeReminders = feeReminders;
    }

    public boolean isAttendanceAlerts() {
        return attendanceAlerts;
    }

    public void setAttendanceAlerts(boolean attendanceAlerts) {
        this.attendanceAlerts = attendanceAlerts;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
