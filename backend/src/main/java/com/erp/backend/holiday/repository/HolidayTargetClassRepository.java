package com.erp.backend.holiday.repository;

import java.util.List;

import com.erp.backend.holiday.entity.HolidayTargetClass;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HolidayTargetClassRepository extends JpaRepository<HolidayTargetClass, Long> {

    List<HolidayTargetClass> findAllByHolidayId(Long holidayId);

    void deleteAllByHolidayId(Long holidayId);
}
