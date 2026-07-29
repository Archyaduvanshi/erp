import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  Hotel,
  HousePlus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { hostelApi, studentApi } from '../../utils/api';

const today = new Date().toISOString().split('T')[0];

const initialHostelForm = {
  hostelName: '',
  hostelType: 'boys',
  totalFloors: '1',
  wardenName: '',
  contactNumber: '',
  status: 'active',
};

const initialRoomForm = {
  hostelId: '',
  roomNumber: '',
  floorLabel: '',
  capacity: '2',
  roomType: 'Standard',
  acType: 'non-ac',
  status: 'available',
  amenities: '',
  monthlyCharge: '0',
};

const initialResidentForm = {
  className: '',
  section: '',
  studentId: '',
  roomId: '',
  bedNumber: '',
  checkInDate: today,
  monthlyCharge: '',
  guardianContact: '',
  emergencyContact: '',
  notes: '',
};

const HostelManagement = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [overview, setOverview] = useState({
    totalHostels: 0,
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
    studentsInHostel: 0,
    pendingRequests: 0,
  });
  const [hostels, setHostels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [residents, setResidents] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostelForm, setHostelForm] = useState(initialHostelForm);
  const [roomForm, setRoomForm] = useState(initialRoomForm);
  const [residentForm, setResidentForm] = useState(initialResidentForm);
  const [hostelSearch, setHostelSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [residentSearch, setResidentSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const [overviewResponse, hostelsResponse, roomsResponse, residentsResponse, studentsResponse] = await Promise.all([
        hostelApi.getOverview(),
        hostelApi.getHostels(),
        hostelApi.getRooms(),
        hostelApi.getResidents(),
        studentApi.getAll(),
      ]);

      setOverview(overviewResponse);
      setHostels(hostelsResponse);
      setRooms(roomsResponse);
      setResidents(residentsResponse);
      setStudents(studentsResponse);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load hostel records from the server.');
    }
  };

  const filteredHostels = useMemo(() => {
    const query = hostelSearch.trim().toLowerCase();
    return hostels.filter((hostel) => {
      if (!query) return true;
      return (
        String(hostel.hostelName || '').toLowerCase().includes(query) ||
        String(hostel.hostelType || '').toLowerCase().includes(query) ||
        String(hostel.wardenName || '').toLowerCase().includes(query)
      );
    });
  }, [hostelSearch, hostels]);

  const filteredRooms = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();
    return rooms.filter((room) => {
      if (!query) return true;
      return (
        String(room.hostelName || '').toLowerCase().includes(query) ||
        String(room.roomNumber || '').toLowerCase().includes(query) ||
        String(room.floorLabel || '').toLowerCase().includes(query) ||
        String(room.roomType || '').toLowerCase().includes(query)
      );
    });
  }, [roomSearch, rooms]);

  const filteredResidents = useMemo(() => {
    const query = residentSearch.trim().toLowerCase();
    return residents.filter((resident) => {
      if (!query) return true;
      return (
        String(resident.studentName || '').toLowerCase().includes(query) ||
        String(resident.className || '').toLowerCase().includes(query) ||
        String(resident.section || '').toLowerCase().includes(query) ||
        String(resident.hostelName || '').toLowerCase().includes(query) ||
        String(resident.roomNumber || '').toLowerCase().includes(query)
      );
    });
  }, [residentSearch, residents]);

  const classOptions = useMemo(() => (
    [...new Set(students.map((student) => student.className).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  ), [students]);

  const sectionOptions = useMemo(() => (
    [...new Set(
      students
        .filter((student) => !residentForm.className || student.className === residentForm.className)
        .map((student) => student.section)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b))
  ), [residentForm.className, students]);

  const filteredStudentOptions = useMemo(() => students.filter((student) => {
    if (!residentForm.className || !residentForm.section) return false;
    if (String(student.hostelStatus || '').toLowerCase() === 'active' && String(student.id) !== String(residentForm.studentId)) return false;
    return student.className === residentForm.className && student.section === residentForm.section;
  }), [residentForm.className, residentForm.section, residentForm.studentId, students]);

  const availableRooms = useMemo(() => rooms.filter((room) => {
    const vacantBeds = Math.max((Number(room.capacity) || 0) - (Number(room.occupiedBeds) || 0), 0);
    return room.status !== 'maintenance' && vacantBeds > 0;
  }), [rooms]);

  const selectedRoom = rooms.find((room) => String(room.id) === String(residentForm.roomId)) || null;
  const selectedStudent = students.find((student) => String(student.id) === String(residentForm.studentId)) || null;

  const pendingStudents = useMemo(() => students.filter((student) => {
    const requested = ['yes', 'true'].includes(String(student.hostelOptIn || '').toLowerCase());
    const active = String(student.hostelStatus || '').toLowerCase() === 'active';
    return requested && !active;
  }), [students]);

  const handleHostelSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await hostelApi.saveHostel({
        ...hostelForm,
        totalFloors: Math.max(Number(hostelForm.totalFloors) || 1, 1),
      });
      setHostelForm(initialHostelForm);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to save hostel.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoomSave = async (event) => {
    event.preventDefault();
    if (!roomForm.hostelId) return;
    setIsSaving(true);
    try {
      await hostelApi.saveRoom({
        ...roomForm,
        hostelId: Number(roomForm.hostelId),
        capacity: Math.max(Number(roomForm.capacity) || 1, 1),
        monthlyCharge: String(Number(roomForm.monthlyCharge) || 0),
      });
      setRoomForm(initialRoomForm);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to save hostel room.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResidentSave = async (event) => {
    event.preventDefault();
    if (!residentForm.studentId || !residentForm.roomId) return;
    setIsSaving(true);
    try {
      await hostelApi.saveResident({
        studentId: Number(residentForm.studentId),
        roomId: Number(residentForm.roomId),
        bedNumber: residentForm.bedNumber,
        checkInDate: residentForm.checkInDate,
        monthlyCharge: residentForm.monthlyCharge ? String(Number(residentForm.monthlyCharge) || 0) : '',
        guardianContact: residentForm.guardianContact,
        emergencyContact: residentForm.emergencyContact,
        notes: residentForm.notes,
        status: 'active',
      });
      setResidentForm(initialResidentForm);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to save hostel allotment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHostel = async (hostelId) => {
    if (!window.confirm('Delete this hostel?')) return;
    try {
      await hostelApi.deleteHostel(hostelId);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to delete hostel.');
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room?')) return;
    try {
      await hostelApi.deleteRoom(roomId);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to delete room.');
    }
  };

  const handleDeleteResident = async (residentId) => {
    if (!window.confirm('Remove this student from hostel?')) return;
    try {
      await hostelApi.deleteResident(residentId);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to remove hostel allotment.');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d1fae5_0%,#f8fafc_36%,#e0f2fe_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Hostel Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Hostel Operations Desk</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-4xl border border-emerald-200/50 bg-[linear-gradient(135deg,#052e16_0%,#166534_36%,#0f766e_100%)] px-7 py-8 text-white shadow-[0_30px_80px_-40px_rgba(6,78,59,0.85)] lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-emerald-200">Hostel Overview</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Total hostel, rooms, beds, allotments, and pending requests ek hi screen par.
              </h2>
              <div className="mt-6 flex flex-wrap gap-3">
                <HeroBadge icon={Hotel} text={`${overview.totalHostels} total hostel`} />
                <HeroBadge icon={BedDouble} text={`${overview.occupiedBeds}/${overview.totalBeds} beds occupied`} />
                <HeroBadge icon={DoorOpen} text={`${overview.vacantBeds} vacant beds`} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Students In Hostel" value={overview.studentsInHostel} icon={Users} />
              <MetricCard label="Pending Requests" value={overview.pendingRequests} icon={HousePlus} />
              <MetricCard label="Total Rooms" value={overview.totalRooms} icon={Building2} />
              <MetricCard label="Vacant Beds" value={overview.vacantBeds} icon={DoorOpen} />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
          <div className="grid gap-3 md:grid-cols-4">
            <DeskTab active={activeSection === 'overview'} icon={ClipboardCheck} label="Overview" text="Summary and requests" onClick={() => setActiveSection('overview')} />
            <DeskTab active={activeSection === 'hostels'} icon={Hotel} label="Hostel Management" text="Create hostel" onClick={() => setActiveSection('hostels')} />
            <DeskTab active={activeSection === 'rooms'} icon={Building2} label="Room Management" text="Manage room inventory" onClick={() => setActiveSection('rooms')} />
            <DeskTab active={activeSection === 'allotment'} icon={UserPlus} label="Student Allotment" text="Assign room and bed" onClick={() => setActiveSection('allotment')} />
          </div>
        </section>

        {activeSection === 'overview' ? (
          <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel title="Overview Summary" description="Hostel overview with total hostel, total rooms, total beds, occupied beds, vacant beds, students in hostel, and pending requests.">
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SnapshotCard label="Total Hostel" value={overview.totalHostels} hint="All active hostel masters" />
                <SnapshotCard label="Total Rooms" value={overview.totalRooms} hint="All rooms across hostels" />
                <SnapshotCard label="Total Beds" value={overview.totalBeds} hint="Sum of room capacities" />
                <SnapshotCard label="Occupied Beds" value={overview.occupiedBeds} hint="Beds already allotted" />
                <SnapshotCard label="Vacant Beds" value={overview.vacantBeds} hint="Beds available for allotment" />
                <SnapshotCard label="Students In Hostel" value={overview.studentsInHostel} hint="Current active hostel students" />
              </div>
            </Panel>

            <Panel title="Pending Requests" description="Students who requested hostel but are not allotted yet.">
              <div className="mt-6 grid gap-4">
                {pendingStudents.length ? pendingStudents.map((student) => (
                  <QuickRow
                    key={student.id}
                    icon={Users}
                    title={`${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'}
                    subtitle={`${student.className || 'Class'} | ${student.section || 'Section'} | ${student.enrollmentNo || 'Enrollment pending'}`}
                    badge="pending"
                  />
                )) : (
                  <EmptyInline text="No pending hostel requests." />
                )}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeSection === 'hostels' ? (
          <div className="mt-8">
            <Panel title="Hostel Management" description="Create hostel with hostel name, boys or girls, total floors, warden name, and contact number.">
              <form className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleHostelSave}>
                <InputField label="Hostel Name" value={hostelForm.hostelName} onChange={(e) => setHostelForm({ ...hostelForm, hostelName: e.target.value })} placeholder="Aarav Boys Hostel" />
                <SelectField label="Hostel Type" value={hostelForm.hostelType} onChange={(e) => setHostelForm({ ...hostelForm, hostelType: e.target.value })} options={['boys', 'girls']} />
                <InputField label="Total Floors" type="number" min="1" value={hostelForm.totalFloors} onChange={(e) => setHostelForm({ ...hostelForm, totalFloors: e.target.value })} />
                <InputField label="Warden Name" value={hostelForm.wardenName} onChange={(e) => setHostelForm({ ...hostelForm, wardenName: e.target.value })} placeholder="Mr Sharma" />
                <InputField label="Contact Number" value={hostelForm.contactNumber} onChange={(e) => setHostelForm({ ...hostelForm, contactNumber: e.target.value })} placeholder="9876543210" />
                <SelectField label="Status" value={hostelForm.status} onChange={(e) => setHostelForm({ ...hostelForm, status: e.target.value })} options={['active', 'inactive']} />
                <div className="md:col-span-2 xl:col-span-3">
                  <PrimaryButton type="submit" icon={HousePlus} label={isSaving ? 'Saving Hostel...' : 'Save Hostel'} />
                </div>
              </form>

              <div className="mt-10 border-t border-slate-200 pt-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-xl font-black tracking-tight text-slate-950">Hostel Register</h4>
                    <p className="mt-1 text-sm text-slate-500">Track all created hostels in Excel table format.</p>
                  </div>
                  <SummaryMini text={`${filteredHostels.length} hostel(s)`} />
                </div>

                <div className="mt-4">
                  <SearchInput value={hostelSearch} onChange={setHostelSearch} placeholder="Search hostel, type, or warden..." />
                </div>

                {filteredHostels.length ? (
                  <ExcelTable className="mt-6">
                    <table className="min-w-full border-collapse bg-white">
                      <thead>
                        <tr className="bg-emerald-50">
                          <Th>Hostel Name</Th>
                          <Th>Type</Th>
                          <Th>Total Floors</Th>
                          <Th>Warden Name</Th>
                          <Th>Contact Number</Th>
                          <Th>Total Rooms</Th>
                          <Th>Total Beds</Th>
                          <Th>Occupied Beds</Th>
                          <Th>Vacant Beds</Th>
                          <Th>Status</Th>
                          <Th noBorder>Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHostels.map((hostel) => (
                          <tr key={hostel.id} className="align-top odd:bg-white even:bg-slate-50">
                            <Td>{hostel.hostelName || '-'}</Td>
                            <Td>{hostel.hostelType || '-'}</Td>
                            <Td>{hostel.totalFloors || 0}</Td>
                            <Td>{hostel.wardenName || 'Warden pending'}</Td>
                            <Td>{hostel.contactNumber || 'Contact pending'}</Td>
                            <Td>{hostel.totalRooms || 0}</Td>
                            <Td>{hostel.totalBeds || 0}</Td>
                            <Td>{hostel.occupiedBeds || 0}</Td>
                            <Td>{hostel.vacantBeds || 0}</Td>
                            <Td><StatusBadge text={hostel.status || 'active'} /></Td>
                            <Td noBorder>
                              <button onClick={() => handleDeleteHostel(hostel.id)} className="inline-flex text-slate-400 transition hover:text-rose-600">
                                <Trash2 size={18} />
                              </button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ExcelTable>
                ) : (
                  <EmptyState icon={Hotel} title="No hostel created yet" description="Create the first hostel to start room management." />
                )}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeSection === 'rooms' ? (
          <div className="mt-8">
            <Panel title="Room Management" description="Create room with room number, floor, capacity, room type, AC or non-AC, and status.">
              <form className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleRoomSave}>
                <SelectField label="Hostel" value={roomForm.hostelId} onChange={(e) => setRoomForm({ ...roomForm, hostelId: e.target.value })} options={['', ...hostels.map((hostel) => String(hostel.id))]} renderOptionLabel={(value) => hostelLabel(value, hostels)} />
                <InputField label="Room Number" value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="101" />
                <InputField label="Floor" value={roomForm.floorLabel} onChange={(e) => setRoomForm({ ...roomForm, floorLabel: e.target.value })} placeholder="1st Floor" />
                <InputField label="Capacity" type="number" min="1" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
                <SelectField label="Room Type" value={roomForm.roomType} onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })} options={['Standard', 'Single', 'Double', 'Dormitory']} />
                <SelectField label="AC Type" value={roomForm.acType} onChange={(e) => setRoomForm({ ...roomForm, acType: e.target.value })} options={['ac', 'non-ac']} />
                <SelectField label="Status" value={roomForm.status} onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })} options={['available', 'maintenance', 'full']} />
                <InputField label="Monthly Charge" type="number" min="0" value={roomForm.monthlyCharge} onChange={(e) => setRoomForm({ ...roomForm, monthlyCharge: e.target.value })} />
                <div className="md:col-span-2 xl:col-span-3">
                  <InputField label="Amenities" value={roomForm.amenities} onChange={(e) => setRoomForm({ ...roomForm, amenities: e.target.value })} placeholder="WiFi, cupboard, study table" />
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <PrimaryButton type="submit" icon={Building2} label={isSaving ? 'Saving Room...' : 'Save Room'} />
                </div>
              </form>

              <div className="mt-10 border-t border-slate-200 pt-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-xl font-black tracking-tight text-slate-950">Room Register</h4>
                    <p className="mt-1 text-sm text-slate-500">See hostel wise rooms in Excel table format.</p>
                  </div>
                  <SummaryMini text={`${filteredRooms.length} room(s)`} />
                </div>

                <div className="mt-4">
                  <SearchInput value={roomSearch} onChange={setRoomSearch} placeholder="Search hostel, room, floor..." />
                </div>

                {filteredRooms.length ? (
                  <ExcelTable className="mt-6">
                    <table className="min-w-full border-collapse bg-white">
                      <thead>
                        <tr className="bg-emerald-50">
                          <Th>Hostel</Th>
                          <Th>Room Number</Th>
                          <Th>Floor</Th>
                          <Th>Capacity</Th>
                          <Th>Occupied Beds</Th>
                          <Th>Vacant Beds</Th>
                          <Th>Room Type</Th>
                          <Th>AC Type</Th>
                          <Th>Status</Th>
                          <Th>Monthly Charge</Th>
                          <Th noBorder>Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRooms.map((room) => {
                          const vacantBeds = Math.max((Number(room.capacity) || 0) - (Number(room.occupiedBeds) || 0), 0);
                          return (
                            <tr key={room.id} className="align-top odd:bg-white even:bg-slate-50">
                              <Td>{room.hostelName || '-'}</Td>
                              <Td>{room.roomNumber || '-'}</Td>
                              <Td>{room.floorLabel || '-'}</Td>
                              <Td>{room.capacity || 0}</Td>
                              <Td>{room.occupiedBeds || 0}</Td>
                              <Td>{vacantBeds}</Td>
                              <Td>{room.roomType || '-'}</Td>
                              <Td>{room.acType || '-'}</Td>
                              <Td><StatusBadge text={room.status || 'available'} /></Td>
                              <Td>Rs {room.monthlyCharge || '0'}</Td>
                              <Td noBorder>
                                <button onClick={() => handleDeleteRoom(room.id)} className="inline-flex text-slate-400 transition hover:text-rose-600">
                                  <Trash2 size={18} />
                                </button>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ExcelTable>
                ) : (
                  <EmptyState icon={Building2} title="No room created yet" description="Create a hostel room to start allotment." />
                )}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeSection === 'allotment' ? (
          <div className="mt-8">
            <Panel title="Student Hostel Allotment" description="Search student, assign room, assign bed, auto vacancy check, transfer room, and remove student from hostel.">
              <form className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleResidentSave}>
                <SelectField label="Class" value={residentForm.className} onChange={(e) => setResidentForm({ ...residentForm, className: e.target.value, section: '', studentId: '' })} options={['', ...classOptions]} renderOptionLabel={(value) => value || 'Select class'} />
                <SelectField label="Section" value={residentForm.section} onChange={(e) => setResidentForm({ ...residentForm, section: e.target.value, studentId: '' })} options={['', ...sectionOptions]} renderOptionLabel={(value) => value || 'Select section'} />
                <SelectField label="Student Search" value={residentForm.studentId} onChange={(e) => setResidentForm({ ...residentForm, studentId: e.target.value })} options={['', ...filteredStudentOptions.map((student) => String(student.id))]} renderOptionLabel={(value) => studentLabel(value, filteredStudentOptions)} />
                <SelectField label="Assign Room" value={residentForm.roomId} onChange={(e) => setResidentForm({ ...residentForm, roomId: e.target.value, monthlyCharge: roomCharge(valueToRoom(e.target.value, rooms)) })} options={['', ...availableRooms.map((room) => String(room.id))]} renderOptionLabel={(value) => roomLabel(value, availableRooms)} />
                <InputField label="Assign Bed" value={residentForm.bedNumber} onChange={(e) => setResidentForm({ ...residentForm, bedNumber: e.target.value })} placeholder="Leave blank for auto" />
                <InputField label="Joining Date" type="date" value={residentForm.checkInDate} onChange={(e) => setResidentForm({ ...residentForm, checkInDate: e.target.value })} />
                <InputField label="Monthly Charge" type="number" min="0" value={residentForm.monthlyCharge} onChange={(e) => setResidentForm({ ...residentForm, monthlyCharge: e.target.value })} placeholder="Auto from room" />
                <InputField label="Guardian Contact" value={residentForm.guardianContact || selectedStudent?.guardianPhone || ''} onChange={(e) => setResidentForm({ ...residentForm, guardianContact: e.target.value })} />
                <InputField label="Emergency Contact" value={residentForm.emergencyContact} onChange={(e) => setResidentForm({ ...residentForm, emergencyContact: e.target.value })} />
                <div className="md:col-span-2 xl:col-span-3 rounded-[1.3rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">
                  {selectedRoom
                    ? `Auto vacancy check: ${Math.max((Number(selectedRoom.capacity) || 0) - (Number(selectedRoom.occupiedBeds) || 0), 0)} bed(s) vacant in ${selectedRoom.hostelName} room ${selectedRoom.roomNumber}.`
                    : 'Auto vacancy check will appear after selecting a room.'}
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <InputField label="Notes" value={residentForm.notes} onChange={(e) => setResidentForm({ ...residentForm, notes: e.target.value })} placeholder="Transfer note, medical note, special instruction" />
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <PrimaryButton type="submit" icon={UserPlus} label={isSaving ? 'Saving Allotment...' : 'Save Allotment'} />
                </div>
              </form>

              <div className="mt-10 border-t border-slate-200 pt-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-xl font-black tracking-tight text-slate-950">Allotment Data</h4>
                    <p className="mt-1 text-sm text-slate-500">Student allotment data in Excel table format.</p>
                  </div>
                  <SummaryMini text={`${filteredResidents.length} allotment(s)`} />
                </div>

                <div className="mt-4">
                  <SearchInput value={residentSearch} onChange={setResidentSearch} placeholder="Search student, class, hostel, room..." />
                </div>

                {filteredResidents.length ? (
                  <ExcelTable className="mt-6">
                    <table className="min-w-full border-collapse bg-white">
                      <thead>
                        <tr className="bg-emerald-50">
                          <Th>Class</Th>
                          <Th>Section</Th>
                          <Th>Student Name</Th>
                          <Th>Hostel</Th>
                          <Th>Room</Th>
                          <Th>Bed</Th>
                          <Th>Joining Date</Th>
                          <Th>Monthly Charge</Th>
                          <Th>Contact</Th>
                          <Th noBorder>Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResidents.map((resident) => (
                          <tr key={resident.id} className="align-top odd:bg-white even:bg-slate-50">
                            <Td>{resident.className || '-'}</Td>
                            <Td>{resident.section || '-'}</Td>
                            <Td>{resident.studentName || '-'}</Td>
                            <Td>{resident.hostelName || '-'}</Td>
                            <Td>{resident.roomNumber || '-'}</Td>
                            <Td>{resident.bedNumber || 'Auto'}</Td>
                            <Td>{resident.checkInDate || '-'}</Td>
                            <Td>Rs {resident.monthlyCharge || '0'}</Td>
                            <Td>{resident.guardianContact || resident.emergencyContact || 'Contact pending'}</Td>
                            <Td noBorder>
                              <button onClick={() => handleDeleteResident(resident.id)} className="inline-flex text-slate-400 transition hover:text-rose-600">
                                <Trash2 size={18} />
                              </button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ExcelTable>
                ) : (
                  <EmptyState icon={Users} title="No allotment created yet" description="Assign a student to a room and bed to see allotment data." />
                )}
              </div>
            </Panel>
          </div>
        ) : null}

      </main>
    </div>
  );
};

const valueToRoom = (roomId, rooms) => rooms.find((room) => String(room.id) === String(roomId)) || null;

const roomCharge = (room) => (room?.monthlyCharge ? String(room.monthlyCharge) : '');

const hostelLabel = (value, hostels) => {
  if (!value) return 'Select hostel';
  const hostel = hostels.find((entry) => String(entry.id) === String(value));
  return hostel ? `${hostel.hostelName} | ${hostel.hostelType}` : 'Select hostel';
};

const studentLabel = (value, students) => {
  if (!value) return 'Select student';
  const student = students.find((entry) => String(entry.id) === String(value));
  return student
    ? `${`${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'} | ${student.className || '-'} | ${student.section || '-'}`
    : 'Select student';
};

const roomLabel = (value, rooms) => {
  if (!value) return 'Select room';
  const room = rooms.find((entry) => String(entry.id) === String(value));
  if (!room) return 'Select room';
  const vacantBeds = Math.max((Number(room.capacity) || 0) - (Number(room.occupiedBeds) || 0), 0);
  return `${room.hostelName} | ${room.roomNumber} | ${vacantBeds} vacant`;
};

const HeroBadge = ({ icon: Icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
    <Icon size={14} />
    <span>{text}</span>
  </div>
);

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50/80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const DeskTab = ({ active, icon: Icon, label, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-3xl border p-4 text-left transition ${
      active
        ? 'border-emerald-300 bg-emerald-50 shadow-[0_18px_40px_-30px_rgba(16,185,129,0.4)]'
        : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50'
    }`}
  >
    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
      <Icon size={20} />
    </div>
    <h3 className="mt-4 text-base font-black tracking-tight text-slate-950">{label}</h3>
    <p className="mt-1 text-sm text-slate-500">{text}</p>
  </button>
);

const Panel = ({ title, description, children }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const SnapshotCard = ({ label, value, hint }) => (
  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
    <p className="mt-2 text-sm text-slate-500">{hint}</p>
  </div>
);

const QuickRow = ({ icon: Icon, title, subtitle, badge }) => (
  <div className="flex items-center justify-between gap-4 rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-4">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{subtitle}</p>
      </div>
    </div>
    <StatusBadge text={badge} />
  </div>
);

const EmptyInline = ({ text }) => (
  <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
    {text}
  </div>
);

const SummaryMini = ({ text }) => (
  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
    {text}
  </div>
);

const ExcelTable = ({ className = '', children }) => (
  <div className={`overflow-hidden rounded-[1.6rem] border border-slate-200 ${className}`}>
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const Th = ({ children, noBorder = false }) => (
  <th className={`border-b border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 ${noBorder ? '' : 'border-r'}`}>
    {children}
  </th>
);

const Td = ({ children, noBorder = false }) => (
  <td className={`border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 ${noBorder ? '' : 'border-r'}`}>
    {children}
  </td>
);

const StatusBadge = ({ text }) => (
  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
    {text}
  </span>
);

const InputField = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const SelectField = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
        </option>
      ))}
    </select>
  </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative w-full">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const PrimaryButton = ({ type, icon: Icon, label }) => (
  <button
    type={type}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
  >
    <Icon size={15} />
    {label}
  </button>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Icon size={34} />
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

export default HostelManagement;
