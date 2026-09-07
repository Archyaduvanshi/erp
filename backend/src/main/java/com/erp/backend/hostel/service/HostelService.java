package com.erp.backend.hostel.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.service.FeeService;
import com.erp.backend.hostel.dto.HostelMessMenuPayload;
import com.erp.backend.hostel.dto.HostelMessSummaryProjection;
import com.erp.backend.hostel.dto.HostelMessSummaryResponse;
import com.erp.backend.hostel.dto.HostelOverviewProjection;
import com.erp.backend.hostel.dto.HostelOverviewResponse;
import com.erp.backend.hostel.dto.HostelPayload;
import com.erp.backend.hostel.dto.HostelResidentPayload;
import com.erp.backend.hostel.dto.HostelResidentResponse;
import com.erp.backend.hostel.dto.HostelResponse;
import com.erp.backend.hostel.dto.HostelRoomPayload;
import com.erp.backend.hostel.dto.HostelRoomResponse;
import com.erp.backend.hostel.dto.HostelStudentLookupResponse;
import com.erp.backend.hostel.dto.HostelStudentMeResponse;
import com.erp.backend.hostel.dto.HostelStudentSearchResponse;
import com.erp.backend.hostel.entity.Hostel;
import com.erp.backend.hostel.entity.HostelMessMenu;
import com.erp.backend.hostel.entity.HostelResident;
import com.erp.backend.hostel.entity.HostelRoom;
import com.erp.backend.hostel.repository.HostelMessMenuRepository;
import com.erp.backend.hostel.repository.HostelRepository;
import com.erp.backend.hostel.repository.HostelResidentRepository;
import com.erp.backend.hostel.repository.HostelRoomRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class HostelService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final HostelRepository hostelRepository;
    private final HostelRoomRepository hostelRoomRepository;
    private final HostelResidentRepository hostelResidentRepository;
    private final HostelMessMenuRepository hostelMessMenuRepository;
    private final FeeService feeService;
    private final ObjectMapper objectMapper;

    public HostelService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            AcademicSessionRepository academicSessionRepository,
            HostelRepository hostelRepository,
            HostelRoomRepository hostelRoomRepository,
            HostelResidentRepository hostelResidentRepository,
            HostelMessMenuRepository hostelMessMenuRepository,
            FeeService feeService,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.hostelRepository = hostelRepository;
        this.hostelRoomRepository = hostelRoomRepository;
        this.hostelResidentRepository = hostelResidentRepository;
        this.hostelMessMenuRepository = hostelMessMenuRepository;
        this.feeService = feeService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public HostelOverviewResponse getOverview(Long instituteId) {
        HostelOverviewProjection overview = hostelResidentRepository.getOverview(instituteId);
        if (overview == null) {
            return new HostelOverviewResponse(0, 0, 0, 0, 0, 0, 0);
        }
        long vacantBeds = Math.max(overview.totalBeds() - overview.occupiedBeds(), 0);
        return new HostelOverviewResponse(
                safeInt(overview.totalHostels()),
                safeInt(overview.totalRooms()),
                safeInt(overview.totalBeds()),
                safeInt(overview.occupiedBeds()),
                safeInt(vacantBeds),
                safeInt(overview.activeResidents()),
                safeInt(overview.pendingRequests())
        );
    }

    @Transactional(readOnly = true)
    public List<HostelResponse> getHostels(Long instituteId) {
        return hostelRepository.findHostelList(instituteId);
    }

    @Transactional
    public HostelResponse saveHostel(Long instituteId, HostelPayload request) {
        Institute institute = validateInstitute(instituteId);
        String hostelName = request.hostelName().trim().toUpperCase(Locale.ROOT);
        if (hostelRepository.existsNonArchivedByInstituteIdAndHostelNameIgnoreCase(instituteId, hostelName)) {
            throw new IllegalArgumentException("DUPLICATE_HOSTEL_NAME: Hostel name already exists.");
        }
        Hostel hostel = new Hostel();
        hostel.setInstitute(institute);
        hostel.setHostelName(hostelName);
        hostel.setHostelType(defaultValue(request.hostelType(), "boys"));
        hostel.setTotalFloors(Math.max(request.totalFloors() == null ? 1 : request.totalFloors(), 1));
        hostel.setWardenName(trimUpper(request.wardenName()));
        hostel.setContactNumber(trim(request.contactNumber()));
        hostel.setStatus(defaultValue(request.status(), "active").toLowerCase(Locale.ROOT));
        Hostel savedHostel = saveWithConstraintHandling(() -> hostelRepository.saveAndFlush(hostel));
        return new HostelResponse(savedHostel.getId(), savedHostel.getHostelName(), savedHostel.getHostelType(),
                savedHostel.getTotalFloors(), savedHostel.getWardenName(), savedHostel.getContactNumber(),
                savedHostel.getStatus(), 0L, 0L, 0L, 0L, savedHostel.getCreatedAt(), savedHostel.getUpdatedAt());
    }

    @Transactional
    public void deleteHostel(Long instituteId, Long hostelId) {
        Hostel hostel = findHostel(instituteId, hostelId);
        if (hostelRoomRepository.existsByInstituteIdAndHostelId(instituteId, hostelId)) {
            if (hostelResidentRepository.existsActiveAllocationByHostel(instituteId, hostelId)) {
                throw new IllegalArgumentException("HOSTEL_HAS_ACTIVE_RESIDENTS: Move or vacate active residents before archiving this hostel.");
            }
            hostel.setStatus("archived");
            hostelRepository.save(hostel);
            return;
        }
        hostelRepository.delete(hostel);
    }

    @Transactional(readOnly = true)
    public List<HostelRoomResponse> getRooms(Long instituteId, Long hostelId, String floor, String status) {
        if (hostelId != null) {
            findHostel(instituteId, hostelId);
        }
        return hostelRoomRepository.findRoomResponses(instituteId, hostelId, defaultValue(floor, ""), defaultValue(status, ""));
    }

    @Transactional
    public HostelRoomResponse saveRoom(Long instituteId, HostelRoomPayload request) {
        Hostel hostel = findActiveHostel(instituteId, request.hostelId());
        String roomNumber = request.roomNumber().trim().toUpperCase(Locale.ROOT);
        if (hostelRoomRepository.existsNonArchivedByInstituteIdAndHostelIdAndRoomNumberIgnoreCase(instituteId, hostel.getId(), roomNumber, null)) {
            throw new IllegalArgumentException("DUPLICATE_ROOM_NUMBER: Room number already exists in this hostel.");
        }
        HostelRoom room = new HostelRoom();
        room.setInstitute(hostel.getInstitute());
        room.setHostel(hostel);
        applyRoomPayload(room, request);
        room.setOccupiedBeds(0);
        HostelRoom savedRoom = saveWithConstraintHandling(() -> hostelRoomRepository.saveAndFlush(room));
        return toRoomResponse(savedRoom);
    }

    @Transactional
    public HostelRoomResponse updateRoom(Long instituteId, Long roomId, HostelRoomPayload request) {
        HostelRoom room = findRoom(instituteId, roomId);
        Hostel hostel = findActiveHostel(instituteId, request.hostelId());
        String roomNumber = request.roomNumber().trim().toUpperCase(Locale.ROOT);
        if (hostelRoomRepository.existsNonArchivedByInstituteIdAndHostelIdAndRoomNumberIgnoreCase(instituteId, hostel.getId(), roomNumber, roomId)) {
            throw new IllegalArgumentException("DUPLICATE_ROOM_NUMBER: Room number already exists in this hostel.");
        }
        int occupiedBeds = safeInt(hostelResidentRepository.countActiveAllocationsForRoom(instituteId, roomId));
        int capacity = Math.max(request.capacity() == null ? 1 : request.capacity(), 1);
        if (capacity < occupiedBeds) {
            throw new IllegalArgumentException("ROOM_CAPACITY_BELOW_OCCUPANCY: Capacity cannot be less than active students in this room.");
        }
        room.setHostel(hostel);
        room.setInstitute(hostel.getInstitute());
        applyRoomPayload(room, request);
        room.setOccupiedBeds(occupiedBeds);
        room.setStatus(resolveRoomStatus(room, occupiedBeds));
        return toRoomResponse(saveWithConstraintHandling(() -> hostelRoomRepository.saveAndFlush(room)));
    }

    @Transactional
    public List<HostelRoomResponse> saveRooms(Long instituteId, List<HostelRoomPayload> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("At least one room is required.");
        }
        Set<Long> hostelIds = requests.stream()
                .map(HostelRoomPayload::hostelId)
                .collect(Collectors.toSet());
        if (hostelIds.contains(null)) {
            throw new IllegalArgumentException("Hostel is required for every room row.");
        }
        Map<Long, Hostel> hostels = hostelRepository.findActiveHostelsByInstituteIdAndIdIn(instituteId, hostelIds).stream()
                .collect(Collectors.toMap(Hostel::getId, hostel -> hostel));
        if (hostels.size() != hostelIds.size()) {
            throw new IllegalArgumentException("HOSTEL_NOT_ACTIVE: Rooms can only be created under active hostels.");
        }
        List<HostelRoom> rooms = requests.stream().map(request -> {
            Hostel hostel = hostels.get(request.hostelId());
            HostelRoom room = new HostelRoom();
            room.setInstitute(hostel.getInstitute());
            room.setHostel(hostel);
            applyRoomPayload(room, request);
            room.setOccupiedBeds(0);
            return room;
        }).toList();
        return saveWithConstraintHandling(() -> hostelRoomRepository.saveAllAndFlush(rooms)).stream()
                .map(this::toRoomResponse)
                .toList();
    }

    @Transactional
    public void deleteRoom(Long instituteId, Long roomId) {
        HostelRoom room = findRoom(instituteId, roomId);
        if (hostelResidentRepository.existsActiveAllocationByRoom(instituteId, roomId)) {
            throw new IllegalArgumentException("ROOM_HAS_ACTIVE_RESIDENTS: Move or vacate active residents before deleting this room.");
        }
        if (hostelResidentRepository.countByInstituteIdAndRoomId(instituteId, roomId) > 0) {
            room.setStatus("archived");
            hostelRoomRepository.save(room);
            return;
        }
        hostelRoomRepository.delete(room);
    }

    @Transactional(readOnly = true)
    public Page<HostelResidentResponse> getResidents(Long instituteId, Long hostelId, Long roomId, String status, String search, Pageable pageable) {
        return hostelResidentRepository.findResidentResponses(instituteId, hostelId, roomId, defaultValue(status, ""), defaultValue(search, ""), pageable);
    }

    @Transactional(readOnly = true)
    public HostelResidentResponse getCurrentStudentResident(Long instituteId, Long studentId) {
        List<HostelResidentResponse> residents = hostelResidentRepository.findStudentResidentResponses(instituteId, studentId, Pageable.ofSize(1));
        return residents.isEmpty() ? null : residents.get(0);
    }

    @Transactional(readOnly = true)
    public HostelStudentMeResponse getStudentHostelDetails(Long instituteId, Long studentId) {
        Student student = findStudent(instituteId, studentId);
        HostelResidentResponse resident = getCurrentStudentResident(instituteId, studentId);
        String hostelOptIn = defaultValue(student.getHostelOptIn(), "no");
        String hostelStatus = defaultValue(student.getHostelStatus(), "inactive");
        boolean requested = "yes".equalsIgnoreCase(hostelOptIn) || "true".equalsIgnoreCase(hostelOptIn);
        boolean active = resident != null || (requested && ("active".equalsIgnoreCase(hostelStatus) || "allotted".equalsIgnoreCase(hostelStatus)));

        return new HostelStudentMeResponse(
                student.getId(),
                firstNonBlank(buildStudentName(student), firstNonBlank(student.getName(), student.getEnrollmentNo())),
                getStudentClassName(student),
                getStudentSection(student),
                student.getEnrollmentNo(),
                student.getGuardianPhone(),
                hostelOptIn,
                hostelStatus,
                active,
                resident
        );
    }

    @Transactional(readOnly = true)
    public HostelStudentLookupResponse lookupStudent(Long instituteId, String enrollmentNo) {
        if (!StringUtils.hasText(enrollmentNo)) {
            throw new IllegalArgumentException("Enrollment number is required.");
        }
        Student student = studentRepository.findByInstituteIdAndEnrollmentNoIgnoreCase(instituteId, enrollmentNo.trim())
                .orElseThrow(() -> new ResourceNotFoundException("STUDENT_NOT_FOUND: Student not found with enrollment number: " + enrollmentNo));
        return new HostelStudentLookupResponse(student.getId(), student.getEnrollmentNo(), buildStudentName(student),
                student.getGuardianName(), student.getGuardianPhone(), getStudentClassName(student), getStudentSection(student));
    }

    @Transactional(readOnly = true)
    public Page<HostelStudentSearchResponse> searchStudents(Long instituteId, String search, String className, String section, Pageable pageable) {
        return studentRepository.searchHostelStudents(instituteId, defaultValue(search, ""), defaultValue(className, ""), defaultValue(section, ""), pageable);
    }

    @Transactional
    public HostelResidentResponse saveResident(Long instituteId, HostelResidentPayload request) {
        Student student = findStudent(instituteId, request.studentId());
        HostelRoom room = hostelRoomRepository.findByInstituteIdAndIdForUpdate(instituteId, request.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("Hostel room not found with id: " + request.roomId()));
        validateRoomCanReceiveAllocation(room);
        if (hostelResidentRepository.existsActiveAllocationByStudent(instituteId, student.getId())) {
            throw new IllegalArgumentException("STUDENT_ALREADY_ALLOTTED: Student already has an active hostel allocation.");
        }
        int capacity = room.getCapacity() == null ? 0 : room.getCapacity();
        long activeAllocationCount = hostelResidentRepository.countActiveAllocationsForRoom(instituteId, room.getId());
        if (activeAllocationCount >= capacity) {
            throw new IllegalArgumentException("ROOM_FULL: Selected room is already full.");
        }
        List<HostelResident> activeAllocations = hostelResidentRepository.findActiveAllocationsForRoom(instituteId, room.getId());
        String bedNumber = resolveBedNumber(room, activeAllocations, request.bedNumber());

        HostelResident resident = new HostelResident();
        resident.setInstitute(room.getInstitute());
        resident.setStudent(student);
        resident.setRoom(room);
        resident.setAcademicSession(requiredCurrentAcademicSession(instituteId));
        resident.setBedNumber(bedNumber);
        resident.setCheckInDate(LocalDate.parse(request.checkInDate().trim()));
        resident.setCheckOutDate(null);
        resident.setMonthlyCharge(parseAmount(request.monthlyCharge(), room.getMonthlyCharge()));
        resident.setGuardianContact(trim(request.guardianContact()));
        resident.setMessFood(defaultValue(request.messFood(), "select").toLowerCase(Locale.ROOT));
        resident.setEmergencyContact(trim(request.emergencyContact()));
        resident.setNotes(trimUpper(request.notes()));
        resident.setStatus("active");

        HostelResident savedResident = saveWithConstraintHandling(() -> hostelResidentRepository.saveAndFlush(resident));
        updateRoomOccupancy(room, safeInt(activeAllocationCount + 1));
        markStudentHostelStatus(student, "allotted");
        studentRepository.save(student);
        feeService.synchronizeChargesForStudent(instituteId, student.getId());
        return toResidentResponse(savedResident);
    }

    @Transactional
    public void deleteResident(Long instituteId, Long residentId) {
        HostelResident resident = hostelResidentRepository.findByInstituteIdAndId(instituteId, residentId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel resident not found with id: " + residentId));
        if (isResidentActive(resident)) {
            throw new IllegalArgumentException("ACTIVE_ALLOCATION_HISTORY: Vacate active allocation before archival.");
        }
        resident.setStatus("archived");
        hostelResidentRepository.save(resident);
    }

    @Transactional
    public HostelResidentResponse vacateResident(Long instituteId, Long residentId) {
        HostelResident resident = hostelResidentRepository.findByInstituteIdAndIdForUpdate(instituteId, residentId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel resident not found with id: " + residentId));
        if (!isResidentActive(resident)) {
            return toResidentResponse(resident);
        }
        HostelRoom room = hostelRoomRepository.findByInstituteIdAndIdForUpdate(instituteId, resident.getRoom().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Hostel room not found with id: " + resident.getRoom().getId()));

        resident.setCheckOutDate(LocalDate.now());
        resident.setStatus("vacated");
        HostelResident savedResident = hostelResidentRepository.save(resident);
        int activeCount = safeInt(hostelResidentRepository.countActiveAllocationsForRoom(instituteId, room.getId()));
        updateRoomOccupancy(room, activeCount);
        markStudentHostelStatus(resident.getStudent(), "vacated");
        studentRepository.save(resident.getStudent());
        return toResidentResponse(savedResident);
    }

    @Transactional(readOnly = true)
    public HostelMessMenuPayload getMessMenu(Long instituteId, Long hostelId) {
        findActiveHostel(instituteId, hostelId);
        return hostelMessMenuRepository.findByInstituteIdAndHostelId(instituteId, hostelId)
                .map(menu -> readMessMenu(menu.getMenuJson()))
                .orElseGet(() -> new HostelMessMenuPayload(List.of()));
    }

    @Transactional
    public HostelMessMenuPayload saveMessMenu(Long instituteId, Long hostelId, HostelMessMenuPayload payload) {
        Hostel hostel = findActiveHostel(instituteId, hostelId);
        HostelMessMenu menu = hostelMessMenuRepository.findByInstituteIdAndHostelId(instituteId, hostelId).orElseGet(HostelMessMenu::new);
        menu.setInstitute(hostel.getInstitute());
        menu.setHostel(hostel);
        menu.setAcademicSession(requiredCurrentAcademicSession(instituteId));
        menu.setStatus("active");
        menu.setMenuJson(writeMessMenu(payload));
        hostelMessMenuRepository.save(menu);
        return payload;
    }

    @Transactional(readOnly = true)
    public HostelMessSummaryResponse getMessSummary(Long instituteId, Long hostelId) {
        findActiveHostel(instituteId, hostelId);
        HostelMessSummaryProjection summary = hostelResidentRepository.getMessSummary(instituteId, hostelId);
        if (summary == null) return new HostelMessSummaryResponse(0, 0, 0, 0);
        return new HostelMessSummaryResponse(summary.totalResidents(), summary.vegetarian(), summary.nonVegetarian(), summary.unspecified());
    }

    private Hostel findHostel(Long instituteId, Long hostelId) {
        return hostelRepository.findByInstituteIdAndId(instituteId, hostelId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel not found with id: " + hostelId));
    }

    private Hostel findActiveHostel(Long instituteId, Long hostelId) {
        return hostelRepository.findActiveHostel(instituteId, hostelId)
                .orElseThrow(() -> new IllegalArgumentException("HOSTEL_NOT_ACTIVE: Operation is allowed only for active hostels."));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("STUDENT_NOT_FOUND: Student not found with id: " + studentId));
    }

    private HostelRoom findRoom(Long instituteId, Long roomId) {
        return hostelRoomRepository.findByInstituteIdAndId(instituteId, roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel room not found with id: " + roomId));
    }

    private void validateRoomCanReceiveAllocation(HostelRoom room) {
        String roomStatus = defaultValue(room.getStatus(), "available").toLowerCase(Locale.ROOT);
        String hostelStatus = defaultValue(room.getHostel().getStatus(), "active").toLowerCase(Locale.ROOT);
        if ("archived".equals(hostelStatus)) {
            throw new IllegalArgumentException("HOSTEL_ARCHIVED: Cannot allocate a student into an archived hostel.");
        }
        if (!"active".equals(hostelStatus)) {
            throw new IllegalArgumentException("HOSTEL_NOT_ACTIVE: Cannot allocate a student into an inactive hostel.");
        }
        if ("archived".equals(roomStatus)) {
            throw new IllegalArgumentException("ROOM_ARCHIVED: Cannot allocate a student into an archived room.");
        }
        if ("inactive".equals(roomStatus)) {
            throw new IllegalArgumentException("ROOM_INACTIVE: Cannot allocate a student into an inactive room.");
        }
        if ("maintenance".equals(roomStatus)) {
            throw new IllegalArgumentException("ROOM_MAINTENANCE: Cannot allocate a student into a room under maintenance.");
        }
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyRoomPayload(HostelRoom room, HostelRoomPayload request) {
        room.setRoomNumber(request.roomNumber().trim().toUpperCase(Locale.ROOT));
        room.setFloorLabel(trimUpper(request.floorLabel()));
        room.setRoomType(defaultValue(request.roomType(), "shared"));
        room.setAcType(defaultValue(request.acType(), "non-ac"));
        room.setCapacity(Math.max(request.capacity() == null ? 1 : request.capacity(), 1));
        room.setMonthlyCharge(parseAmount(request.monthlyCharge(), BigDecimal.ZERO));
        room.setAmenities(trimUpper(request.amenities()));
        room.setStatus(defaultValue(request.status(), "available").toLowerCase(Locale.ROOT));
    }

    private HostelRoomResponse toRoomResponse(HostelRoom room) {
        Hostel hostel = room.getHostel();
        return new HostelRoomResponse(room.getId(), hostel.getId(), hostel.getHostelName(), defaultValue(hostel.getHostelType(), "boys"),
                room.getRoomNumber(), room.getFloorLabel(), room.getRoomType(), defaultValue(room.getAcType(), "non-ac"),
                room.getCapacity(), room.getOccupiedBeds() == null ? 0 : room.getOccupiedBeds(), room.getMonthlyCharge(),
                room.getAmenities(), defaultValue(room.getStatus(), "available"), room.getCreatedAt(), room.getUpdatedAt());
    }

    private HostelResidentResponse toResidentResponse(HostelResident resident) {
        Student student = resident.getStudent();
        HostelRoom room = resident.getRoom();
        Hostel hostel = room.getHostel();
        return new HostelResidentResponse(resident.getId(), student.getId(), buildStudentName(student), getStudentClassName(student),
                getStudentSection(student), student.getEnrollmentNo(), hostel.getId(), hostel.getHostelName(), room.getId(),
                room.getRoomNumber(), room.getFloorLabel(), resident.getBedNumber(), resident.getCheckInDate(), resident.getCheckOutDate(),
                resident.getMonthlyCharge(), resident.getGuardianContact(), defaultValue(resident.getMessFood(), "select"),
                resident.getEmergencyContact(), resident.getNotes(), defaultValue(resident.getStatus(), "active"),
                resident.getCreatedAt(), resident.getUpdatedAt());
    }

    private String resolveBedNumber(HostelRoom room, List<HostelResident> activeAllocations, String requestedBedNumber) {
        Set<String> occupiedBeds = activeAllocations.stream()
                .map(HostelResident::getBedNumber)
                .filter(StringUtils::hasText)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        if (StringUtils.hasText(requestedBedNumber)) {
            String normalizedRequestedBed = requestedBedNumber.trim().toUpperCase(Locale.ROOT);
            if (occupiedBeds.contains(normalizedRequestedBed.toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("BED_ALREADY_OCCUPIED: Selected bed is already occupied.");
            }
            return normalizedRequestedBed;
        }
        int capacity = room.getCapacity() == null ? 0 : room.getCapacity();
        for (int index = 1; index <= capacity; index++) {
            String candidate = "BED-" + index;
            if (!occupiedBeds.contains(candidate.toLowerCase(Locale.ROOT))) return candidate;
        }
        throw new IllegalArgumentException("ROOM_FULL: No vacant bed is available in the selected room.");
    }

    private void updateRoomOccupancy(HostelRoom room, int occupiedBeds) {
        room.setOccupiedBeds(occupiedBeds);
        room.setStatus(resolveRoomStatus(room, occupiedBeds));
        hostelRoomRepository.save(room);
    }

    private String resolveRoomStatus(HostelRoom room, int occupiedBeds) {
        int capacity = room.getCapacity() == null ? 0 : room.getCapacity();
        if (occupiedBeds >= capacity) return "full";
        if ("maintenance".equalsIgnoreCase(room.getStatus())) return "maintenance";
        return "available";
    }

    private boolean isResidentActive(HostelResident resident) {
        return resident != null && resident.getCheckOutDate() == null && "active".equalsIgnoreCase(defaultValue(resident.getStatus(), "active"));
    }

    private void markStudentHostelStatus(Student student, String status) {
        student.setHostelOptIn("yes");
        student.setHostelStatus(status);
    }

    private AcademicSession requiredCurrentAcademicSession(Long instituteId) {
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElseThrow(() -> new IllegalArgumentException("CURRENT_ACADEMIC_SESSION_REQUIRED: Mark an academic session as current before creating hostel allocations."));
    }

    private HostelMessMenuPayload readMessMenu(String json) {
        try {
            return objectMapper.readValue(json, HostelMessMenuPayload.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("INVALID_MESS_MENU: Saved mess menu is invalid.");
        }
    }

    private String writeMessMenu(HostelMessMenuPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload == null ? new HostelMessMenuPayload(List.of()) : payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("INVALID_MESS_MENU: Mess menu could not be saved.");
        }
    }

    private <T> T saveWithConstraintHandling(SaveOperation<T> operation) {
        try {
            return operation.save();
        } catch (DataIntegrityViolationException exception) {
            String message = exception.getMostSpecificCause() == null ? "" : exception.getMostSpecificCause().getMessage();
            if (message.contains("uk_hostel_rooms_institute_hostel_room_lower")) {
                throw new IllegalArgumentException("DUPLICATE_ROOM_NUMBER: Room number already exists in this hostel.");
            }
            if (message.contains("uk_hostels_institute_name_lower")) {
                throw new IllegalArgumentException("DUPLICATE_HOSTEL_NAME: Hostel name already exists.");
            }
            if (message.contains("uk_hostel_residents_active_student")) {
                throw new IllegalArgumentException("STUDENT_ALREADY_ALLOTTED: Student already has an active hostel allocation.");
            }
            if (message.contains("uk_hostel_residents_active_room_bed")) {
                throw new IllegalArgumentException("BED_ALREADY_OCCUPIED: Selected bed is already occupied.");
            }
            throw exception;
        }
    }

    private BigDecimal parseAmount(String value, BigDecimal fallback) {
        if (!StringUtils.hasText(value)) return fallback == null ? BigDecimal.ZERO : fallback;
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Amount must be a valid number.");
        }
    }

    private String buildStudentName(Student student) {
        return String.join(" ", defaultValue(student.getFirstName(), "").trim(), defaultValue(student.getLastName(), "").trim()).trim();
    }

    private String getStudentClassName(Student student) {
        String assignedClass = trim(student.getAssignedClass());
        if (assignedClass != null && assignedClass.contains("/")) return assignedClass.split("/", 2)[0].trim();
        return firstNonBlank(student.getClassName(), assignedClass);
    }

    private String getStudentSection(Student student) {
        String assignedClass = trim(student.getAssignedClass());
        if (assignedClass != null && assignedClass.contains("/")) return assignedClass.split("/", 2)[1].trim();
        return trim(student.getSection());
    }

    private int safeInt(long value) {
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) value;
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String trimUpper(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (StringUtils.hasText(primary)) return primary.trim();
        return StringUtils.hasText(fallback) ? fallback.trim() : null;
    }

    @FunctionalInterface
    private interface SaveOperation<T> {
        T save();
    }
}
