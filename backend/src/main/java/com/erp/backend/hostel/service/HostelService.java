package com.erp.backend.hostel.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.hostel.dto.HostelOverviewResponse;
import com.erp.backend.hostel.dto.HostelPayload;
import com.erp.backend.hostel.dto.HostelResidentPayload;
import com.erp.backend.hostel.dto.HostelResidentResponse;
import com.erp.backend.hostel.dto.HostelResponse;
import com.erp.backend.hostel.dto.HostelRoomPayload;
import com.erp.backend.hostel.dto.HostelRoomResponse;
import com.erp.backend.hostel.entity.Hostel;
import com.erp.backend.hostel.entity.HostelResident;
import com.erp.backend.hostel.entity.HostelRoom;
import com.erp.backend.hostel.repository.HostelRepository;
import com.erp.backend.hostel.repository.HostelResidentRepository;
import com.erp.backend.hostel.repository.HostelRoomRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class HostelService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final HostelRepository hostelRepository;
    private final HostelRoomRepository hostelRoomRepository;
    private final HostelResidentRepository hostelResidentRepository;

    public HostelService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            HostelRepository hostelRepository,
            HostelRoomRepository hostelRoomRepository,
            HostelResidentRepository hostelResidentRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.hostelRepository = hostelRepository;
        this.hostelRoomRepository = hostelRoomRepository;
        this.hostelResidentRepository = hostelResidentRepository;
    }

    public HostelOverviewResponse getOverview(Long instituteId) {
        validateInstitute(instituteId);
        List<Hostel> hostels = hostelRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId);
        List<HostelRoom> rooms = hostelRoomRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId);
        List<HostelResident> residents = hostelResidentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId);
        int totalBeds = rooms.stream().mapToInt(room -> room.getCapacity() == null ? 0 : room.getCapacity()).sum();
        int occupiedBeds = rooms.stream().mapToInt(room -> room.getOccupiedBeds() == null ? 0 : room.getOccupiedBeds()).sum();
        int activeResidents = (int) residents.stream().filter(this::isResidentActive).count();
        int pendingRequests = (int) studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .filter(this::hasPendingHostelRequest)
                .count();

        return new HostelOverviewResponse(
                hostels.size(),
                rooms.size(),
                totalBeds,
                occupiedBeds,
                Math.max(totalBeds - occupiedBeds, 0),
                activeResidents,
                pendingRequests
        );
    }

    public List<HostelResponse> getHostels(Long instituteId) {
        validateInstitute(instituteId);
        return hostelRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .sorted(Comparator.comparing(Hostel::getHostelName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(hostel -> toHostelResponse(hostel, hostelRoomRepository.findAllByInstituteIdAndHostelIdOrderByCreatedAtDesc(instituteId, hostel.getId())))
                .toList();
    }

    @Transactional
    public HostelResponse saveHostel(Long instituteId, HostelPayload request) {
        Institute institute = validateInstitute(instituteId);
        Hostel hostel = new Hostel();
        hostel.setInstitute(institute);
        hostel.setHostelName(request.hostelName().trim().toUpperCase(Locale.ROOT));
        hostel.setHostelType(defaultValue(request.hostelType(), "boys"));
        hostel.setTotalFloors(Math.max(request.totalFloors() == null ? 1 : request.totalFloors(), 1));
        hostel.setWardenName(trimUpper(request.wardenName()));
        hostel.setContactNumber(trim(request.contactNumber()));
        hostel.setStatus(defaultValue(request.status(), "active").toLowerCase(Locale.ROOT));
        Hostel savedHostel = hostelRepository.save(hostel);
        return toHostelResponse(savedHostel, List.of());
    }

    @Transactional
    public void deleteHostel(Long instituteId, Long hostelId) {
        Hostel hostel = findHostel(instituteId, hostelId);
        List<HostelRoom> rooms = hostelRoomRepository.findAllByInstituteIdAndHostelIdOrderByCreatedAtDesc(instituteId, hostelId);
        if (!rooms.isEmpty()) {
            throw new IllegalArgumentException("Delete hostel rooms before deleting this hostel.");
        }
        hostelRepository.delete(hostel);
    }

    public List<HostelRoomResponse> getRooms(Long instituteId) {
        validateInstitute(instituteId);
        return hostelRoomRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .sorted(Comparator.comparing((HostelRoom room) -> room.getHostel().getHostelName(), Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(HostelRoom::getFloorLabel, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(HostelRoom::getRoomNumber, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toRoomResponse)
                .toList();
    }

    @Transactional
    public HostelRoomResponse saveRoom(Long instituteId, HostelRoomPayload request) {
        validateInstitute(instituteId);
        Hostel hostel = findHostel(instituteId, request.hostelId());
        HostelRoom room = new HostelRoom();
        room.setInstitute(hostel.getInstitute());
        room.setHostel(hostel);
        applyRoomPayload(room, request, hostel);
        room.setOccupiedBeds(0);
        HostelRoom savedRoom = hostelRoomRepository.save(room);
        return toRoomResponse(savedRoom);
    }

    @Transactional
    public List<HostelRoomResponse> saveRooms(Long instituteId, List<HostelRoomPayload> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("At least one room is required.");
        }
        return requests.stream()
                .map(request -> saveRoom(instituteId, request))
                .toList();
    }

    @Transactional
    public void deleteRoom(Long instituteId, Long roomId) {
        HostelRoom room = findRoom(instituteId, roomId);
        List<HostelResident> residents = hostelResidentRepository.findAllByInstituteIdAndRoomId(instituteId, roomId);
        boolean hasActiveResidents = residents.stream().anyMatch(this::isResidentActive);
        if (hasActiveResidents) {
            throw new IllegalArgumentException("Move or remove active residents before deleting this room.");
        }
        hostelRoomRepository.delete(room);
    }

    public List<HostelResidentResponse> getResidents(Long instituteId) {
        validateInstitute(instituteId);
        return hostelResidentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .sorted(Comparator.comparing((HostelResident resident) -> isResidentActive(resident) ? 0 : 1)
                        .thenComparing(resident -> resident.getRoom().getHostel().getHostelName(), Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(resident -> resident.getRoom().getRoomNumber(), Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toResidentResponse)
                .toList();
    }

    @Transactional
    public HostelResidentResponse saveResident(Long instituteId, HostelResidentPayload request) {
        validateInstitute(instituteId);
        Student student = findStudent(instituteId, request.studentId());
        HostelRoom room = findRoom(instituteId, request.roomId());
        HostelResident resident = hostelResidentRepository.findByInstituteIdAndStudentId(instituteId, request.studentId())
                .orElseGet(() -> {
                    HostelResident newResident = new HostelResident();
                    newResident.setInstitute(room.getInstitute());
                    newResident.setStudent(student);
                    return newResident;
                });

        HostelRoom previousRoom = resident.getRoom();
        if (previousRoom == null || !previousRoom.getId().equals(room.getId()) || !isResidentActive(resident)) {
            ensureRoomCapacityAvailable(instituteId, room, resident.getId());
        }

        String resolvedBedNumber = resolveBedNumber(instituteId, room, resident.getId(), request.bedNumber());

        resident.setRoom(room);
        resident.setBedNumber(resolvedBedNumber.toUpperCase(Locale.ROOT));
        resident.setCheckInDate(LocalDate.parse(request.checkInDate().trim()));
        resident.setCheckOutDate(null);
        resident.setMonthlyCharge(parseAmount(request.monthlyCharge(), room.getMonthlyCharge()));
        resident.setGuardianContact(trim(request.guardianContact()));
        resident.setMessFood(defaultValue(request.messFood(), "select").toLowerCase(Locale.ROOT));
        resident.setEmergencyContact(trim(request.emergencyContact()));
        resident.setNotes(trimUpper(request.notes()));
        resident.setStatus(defaultValue(request.status(), "active").toLowerCase(Locale.ROOT));

        HostelResident savedResident = hostelResidentRepository.save(resident);
        refreshRoomOccupancy(room);
        if (previousRoom != null && !previousRoom.getId().equals(room.getId())) {
            refreshRoomOccupancy(previousRoom);
        }

        markStudentHostelRequested(student);
        markStudentHostelStatus(student, isResidentActive(savedResident));
        studentRepository.save(student);
        return toResidentResponse(savedResident);
    }

    @Transactional
    public void deleteResident(Long instituteId, Long residentId) {
        HostelResident resident = hostelResidentRepository.findByInstituteIdAndId(instituteId, residentId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel resident not found with id: " + residentId));
        HostelRoom room = resident.getRoom();
        Student student = resident.getStudent();
        hostelResidentRepository.delete(resident);
        refreshRoomOccupancy(room);
        markStudentHostelStatus(student, false);
        markStudentHostelRequested(student);
        studentRepository.save(student);
    }

    @Transactional
    public HostelResidentResponse vacateResident(Long instituteId, Long residentId) {
        HostelResident resident = hostelResidentRepository.findByInstituteIdAndId(instituteId, residentId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel resident not found with id: " + residentId));
        HostelRoom room = resident.getRoom();
        Student student = resident.getStudent();

        resident.setCheckOutDate(LocalDate.now());
        resident.setStatus("vacated");
        HostelResident savedResident = hostelResidentRepository.save(resident);
        refreshRoomOccupancy(room);
        markStudentHostelStatus(student, false);
        markStudentHostelRequested(student);
        studentRepository.save(student);
        return toResidentResponse(savedResident);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Hostel findHostel(Long instituteId, Long hostelId) {
        return hostelRepository.findByInstituteIdAndId(instituteId, hostelId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel not found with id: " + hostelId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private HostelRoom findRoom(Long instituteId, Long roomId) {
        return hostelRoomRepository.findByInstituteIdAndId(instituteId, roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Hostel room not found with id: " + roomId));
    }

    private void applyRoomPayload(HostelRoom room, HostelRoomPayload request, Hostel hostel) {
        room.setHostel(hostel);
        room.setRoomNumber(request.roomNumber().trim().toUpperCase(Locale.ROOT));
        room.setFloorLabel(trimUpper(request.floorLabel()));
        room.setRoomType(defaultValue(request.roomType(), "shared"));
        room.setAcType(defaultValue(request.acType(), "non-ac"));
        room.setCapacity(Math.max(request.capacity() == null ? 1 : request.capacity(), 1));
        room.setMonthlyCharge(parseAmount(request.monthlyCharge(), BigDecimal.ZERO));
        room.setAmenities(trimUpper(request.amenities()));
        room.setStatus(defaultValue(request.status(), "available").toLowerCase(Locale.ROOT));
    }

    private HostelResponse toHostelResponse(Hostel hostel, List<HostelRoom> rooms) {
        int totalBeds = rooms.stream().mapToInt(room -> room.getCapacity() == null ? 0 : room.getCapacity()).sum();
        int occupiedBeds = rooms.stream().mapToInt(room -> room.getOccupiedBeds() == null ? 0 : room.getOccupiedBeds()).sum();
        return new HostelResponse(
                hostel.getId(),
                hostel.getHostelName(),
                defaultValue(hostel.getHostelType(), "boys"),
                hostel.getTotalFloors(),
                hostel.getWardenName(),
                hostel.getContactNumber(),
                defaultValue(hostel.getStatus(), "active"),
                rooms.size(),
                totalBeds,
                occupiedBeds,
                Math.max(totalBeds - occupiedBeds, 0),
                hostel.getCreatedAt(),
                hostel.getUpdatedAt()
        );
    }

    private HostelRoomResponse toRoomResponse(HostelRoom room) {
        Hostel hostel = room.getHostel();
        return new HostelRoomResponse(
                room.getId(),
                hostel.getId(),
                hostel.getHostelName(),
                defaultValue(hostel.getHostelType(), "boys"),
                room.getRoomNumber(),
                room.getFloorLabel(),
                room.getRoomType(),
                defaultValue(room.getAcType(), "non-ac"),
                room.getCapacity(),
                room.getOccupiedBeds() == null ? 0 : room.getOccupiedBeds(),
                room.getMonthlyCharge() == null ? "0" : room.getMonthlyCharge().toPlainString(),
                room.getAmenities(),
                defaultValue(room.getStatus(), "available"),
                room.getCreatedAt(),
                room.getUpdatedAt()
        );
    }

    private HostelResidentResponse toResidentResponse(HostelResident resident) {
        Student student = resident.getStudent();
        HostelRoom room = resident.getRoom();
        Hostel hostel = room.getHostel();
        return new HostelResidentResponse(
                resident.getId(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(student.getAssignedClass(), student.getClassName()),
                student.getSection(),
                student.getEnrollmentNo(),
                hostel.getId(),
                hostel.getHostelName(),
                room.getId(),
                room.getRoomNumber(),
                room.getFloorLabel(),
                resident.getBedNumber(),
                resident.getCheckInDate() == null ? null : resident.getCheckInDate().toString(),
                resident.getCheckOutDate() == null ? null : resident.getCheckOutDate().toString(),
                resident.getMonthlyCharge() == null ? "0" : resident.getMonthlyCharge().toPlainString(),
                resident.getGuardianContact(),
                defaultValue(resident.getMessFood(), "select"),
                resident.getEmergencyContact(),
                resident.getNotes(),
                defaultValue(resident.getStatus(), "active"),
                resident.getCreatedAt(),
                resident.getUpdatedAt()
        );
    }

    private void ensureRoomCapacityAvailable(Long instituteId, HostelRoom room, Long currentResidentId) {
        long activeResidents = hostelResidentRepository.findAllByInstituteIdAndRoomId(instituteId, room.getId()).stream()
                .filter(this::isResidentActive)
                .filter(resident -> currentResidentId == null || !resident.getId().equals(currentResidentId))
                .count();

        int capacity = room.getCapacity() == null ? 0 : room.getCapacity();
        if (activeResidents >= capacity) {
            throw new IllegalArgumentException("Selected room is already full.");
        }
    }

    private String resolveBedNumber(Long instituteId, HostelRoom room, Long currentResidentId, String requestedBedNumber) {
        List<String> occupiedBeds = hostelResidentRepository.findAllByInstituteIdAndRoomId(instituteId, room.getId()).stream()
                .filter(this::isResidentActive)
                .filter(resident -> currentResidentId == null || !resident.getId().equals(currentResidentId))
                .map(HostelResident::getBedNumber)
                .filter(StringUtils::hasText)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .toList();

        if (StringUtils.hasText(requestedBedNumber)) {
            String normalizedRequestedBed = requestedBedNumber.trim().toUpperCase(Locale.ROOT);
            if (occupiedBeds.contains(normalizedRequestedBed.toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Selected bed is already occupied.");
            }
            return normalizedRequestedBed;
        }

        int capacity = room.getCapacity() == null ? 0 : room.getCapacity();
        for (int index = 1; index <= capacity; index++) {
            String candidate = "Bed-" + index;
            if (!occupiedBeds.contains(candidate.toLowerCase(Locale.ROOT))) {
                return candidate;
            }
        }

        throw new IllegalArgumentException("No vacant bed is available in the selected room.");
    }

    private void refreshRoomOccupancy(HostelRoom room) {
        int occupiedBeds = (int) hostelResidentRepository.findAllByInstituteIdAndRoomId(room.getInstitute().getId(), room.getId()).stream()
                .filter(this::isResidentActive)
                .count();
        room.setOccupiedBeds(occupiedBeds);
        room.setStatus(resolveRoomStatus(room, occupiedBeds));
        hostelRoomRepository.save(room);
    }

    private String resolveRoomStatus(HostelRoom room, int occupiedBeds) {
        int capacity = room.getCapacity() == null ? 0 : room.getCapacity();
        if (occupiedBeds >= capacity) {
            return "full";
        }
        if ("maintenance".equalsIgnoreCase(room.getStatus())) {
            return "maintenance";
        }
        return "available";
    }

    private boolean isResidentActive(HostelResident resident) {
        return resident != null
                && resident.getCheckOutDate() == null
                && "active".equalsIgnoreCase(defaultValue(resident.getStatus(), "active"));
    }

    private boolean hasPendingHostelRequest(Student student) {
        boolean requested = "yes".equalsIgnoreCase(defaultValue(student.getHostelOptIn(), "no"))
                || "true".equalsIgnoreCase(defaultValue(student.getHostelOptIn(), "no"));
        boolean active = "active".equalsIgnoreCase(defaultValue(student.getHostelStatus(), "inactive"));
        return requested && !active;
    }

    private void markStudentHostelRequested(Student student) {
        student.setHostelOptIn("yes");
    }

    private void markStudentHostelStatus(Student student, boolean active) {
        student.setHostelStatus(active ? "active" : "inactive");
    }

    private BigDecimal parseAmount(String value, BigDecimal fallback) {
        if (!StringUtils.hasText(value)) {
            return fallback;
        }

        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Amount must be a valid number.");
        }
    }

    private String buildStudentName(Student student) {
        return String.join(" ",
                defaultValue(student.getFirstName(), "").trim(),
                defaultValue(student.getLastName(), "").trim()).trim();
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
        if (StringUtils.hasText(primary)) {
            return primary.trim();
        }
        return StringUtils.hasText(fallback) ? fallback.trim() : null;
    }
}
