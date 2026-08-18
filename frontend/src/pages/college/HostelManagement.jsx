import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Hotel,
  HousePlus,
  Plus,
  Save,
  Search,
  Trash2,
  Utensils,
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

const initialBulkRoomForm = {
  hostelId: '',
  floorNumber: '',
  startRoomNumber: '1',
  endRoomNumber: '10',
  capacity: '2',
  acType: 'non-ac',
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
  messFood: 'select',
  emergencyContact: '',
  notes: '',
};

const MESS_FOOD_OPTIONS = ['select', 'vegetarian', 'non-vegetarian'];
const MESS_MENU_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MESS_MENU_TYPES = [
  { key: 'vegetarian', title: 'Vegetarian Menu', tone: 'emerald' },
  { key: 'nonVegetarian', title: 'Non-Vegetarian Menu', tone: 'rose' },
];

const HostelManagement = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [residents, setResidents] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostelForm, setHostelForm] = useState(initialHostelForm);
  const [bulkRoomForm, setBulkRoomForm] = useState(initialBulkRoomForm);
  const [bulkRoomPreview, setBulkRoomPreview] = useState([]);
  const [residentForm, setResidentForm] = useState(initialResidentForm);
  const [messMenuRows, setMessMenuRows] = useState(() => loadMessMenuRows());
  const [selectedRoomHostelId, setSelectedRoomHostelId] = useState('');
  const [selectedRoomFloor, setSelectedRoomFloor] = useState('');
  const [selectedAllotmentRoomId, setSelectedAllotmentRoomId] = useState('');
  const [showAllotmentForm, setShowAllotmentForm] = useState(false);
  const [hostelSearch, setHostelSearch] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const [hostelsResponse, roomsResponse, residentsResponse, studentsResponse] = await Promise.all([
        hostelApi.getHostels(),
        hostelApi.getRooms(),
        hostelApi.getResidents(),
        studentApi.getAll(),
      ]);

      setHostels(hostelsResponse || []);
      setRooms(roomsResponse || []);
      setResidents(residentsResponse || []);
      setStudents(studentsResponse || []);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load hostel records from the server.');
    }
  };

  const workspaceCards = [
    { key: 'hostels', icon: Hotel, title: 'Hostel Management', text: 'Create hostel buildings and maintain warden details.' },
    { key: 'rooms', icon: Building2, title: 'Room Management', text: 'Create rooms, bed capacity, charges, and availability.' },
    { key: 'mess-food', icon: Utensils, title: 'Mess Food Management', text: 'Review vegetarian and non-vegetarian hostel food choices.' },
  ];

  const filteredHostels = useMemo(() => filterRecords(hostels, hostelSearch, ['hostelName', 'hostelType', 'wardenName', 'contactNumber']), [hostelSearch, hostels]);
  const selectedRoomHostel = hostels.find((hostel) => String(hostel.id) === String(selectedRoomHostelId)) || null;
  const selectedHostelFloorOptions = floorOptions(selectedRoomHostelId, hostels);
  const selectedFloorRooms = useMemo(() => rooms
    .filter((room) => String(room.hostelId) === String(selectedRoomHostelId))
    .filter((room) => !selectedRoomFloor || normalizeFloorValue(room.floorLabel) === String(selectedRoomFloor))
    .sort((a, b) => String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), undefined, { numeric: true })),
  [rooms, selectedRoomFloor, selectedRoomHostelId]);
  const selectedAllotmentRoom = rooms.find((room) => String(room.id) === String(selectedAllotmentRoomId)) || null;
  const selectedRoomResidents = useMemo(() => residents
    .filter((resident) => String(resident.roomId) === String(selectedAllotmentRoomId))
    .sort((a, b) => String(b.checkInDate || '').localeCompare(String(a.checkInDate || ''))),
  [residents, selectedAllotmentRoomId]);
  const activeSelectedRoomResidents = selectedRoomResidents.filter(isActiveResident);
  const activeMessResidents = useMemo(() => residents.filter(isActiveResident), [residents]);
  const messFoodStats = useMemo(() => ({
    total: activeMessResidents.length,
    vegetarian: activeMessResidents.filter((resident) => normalizeMessFood(resident.messFood) === 'vegetarian').length,
    nonVegetarian: activeMessResidents.filter((resident) => normalizeMessFood(resident.messFood) === 'non-vegetarian').length,
    pending: activeMessResidents.filter((resident) => normalizeMessFood(resident.messFood) === 'select').length,
  }), [activeMessResidents]);

  const classOptions = useMemo(() => (
    [...new Set(students.map(getStudentClass).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  ), [students]);

  const sectionOptions = useMemo(() => (
    [...new Set(
      students
        .filter((student) => !residentForm.className || getStudentClass(student) === residentForm.className)
        .map((student) => student.section)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b))
  ), [residentForm.className, students]);

  const filteredStudentOptions = useMemo(() => students.filter((student) => {
    if (!residentForm.className || !residentForm.section) return false;
    if (getStudentClass(student) !== residentForm.className || student.section !== residentForm.section) return false;
    const alreadyAllotted = residents.some((resident) => isActiveResident(resident) && String(resident.studentId) === String(student.id));
    return !alreadyAllotted || String(student.id) === String(residentForm.studentId);
  }), [residentForm.className, residentForm.section, residentForm.studentId, residents, students]);

  const selectedStudent = students.find((student) => String(student.id) === String(residentForm.studentId)) || null;
  const selectedStudentContact = selectedStudent ? studentContact(selectedStudent.id, students) : '';

  const handleBack = () => {
    if (activeSection === 'room-generator') {
      setActiveSection('rooms');
      setFormErrors({});
      return;
    }
    if (activeSection) {
      setActiveSection(null);
      setFormErrors({});
      return;
    }
    navigate('/college');
  };

  const clearFieldError = (field) => {
    setFormErrors((current) => {
      if (!current[field]) return current;
      const { [field]: removed, ...rest } = current;
      return rest;
    });
  };

  const updateHostelForm = (field, value) => {
    setHostelForm((current) => ({ ...current, [field]: shouldUppercase(field) ? value.toUpperCase() : value }));
    clearFieldError(field);
  };

  const updateBulkRoomForm = (field, value) => {
    setBulkRoomForm((current) => ({ ...current, [field]: shouldUppercase(field) ? value.toUpperCase() : value }));
    clearFieldError(field);
  };

  const updateResidentForm = (patch) => {
    setResidentForm((current) => ({ ...current, ...patch }));
    Object.keys(patch).forEach(clearFieldError);
  };

  const openAllotmentFormForRoom = (room) => {
    setActiveSection('rooms');
    setSelectedAllotmentRoomId(String(room.id));
    setShowAllotmentForm(true);
    setResidentForm({
      ...initialResidentForm,
      roomId: String(room.id),
      monthlyCharge: roomCharge(room),
    });
    setFormErrors({});
  };

  const handleHostelSave = async (event) => {
    event.preventDefault();
    const errors = validateHostelForm(hostelForm);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      await hostelApi.saveHostel({
        ...hostelForm,
        totalFloors: Math.max(Number(hostelForm.totalFloors) || 1, 1),
      });
      setHostelForm(initialHostelForm);
      setFormErrors({});
      await refreshData();
    } catch (error) {
      setFormErrors(error.fieldErrors || {});
      setLoadError(error.message || 'Unable to save hostel.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateRooms = (event) => {
    event.preventDefault();
    const errors = validateBulkRoomForm(bulkRoomForm);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setBulkRoomPreview(generateRoomPreview(bulkRoomForm, hostels));
    setFormErrors({});
  };

  const handleSaveGeneratedRooms = async () => {
    if (!bulkRoomPreview.length) {
      setFormErrors({ preview: 'Generate room preview before saving.' });
      return;
    }
    setIsSaving(true);
    try {
      await hostelApi.saveRooms(bulkRoomPreview.map(({ previewId, hostelName, ...room }) => room));
      setBulkRoomForm(initialBulkRoomForm);
      setBulkRoomPreview([]);
      setFormErrors({});
      await refreshData();
    } catch (error) {
      setFormErrors(error.fieldErrors || {});
      setLoadError(error.message || 'Unable to save generated rooms.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResidentSave = async (event) => {
    event.preventDefault();
    const errors = validateResidentForm(residentForm);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      await hostelApi.saveResident({
        studentId: Number(residentForm.studentId),
        roomId: Number(residentForm.roomId),
        bedNumber: residentForm.bedNumber,
        checkInDate: residentForm.checkInDate,
        monthlyCharge: residentForm.monthlyCharge ? String(Number(residentForm.monthlyCharge) || 0) : '',
        guardianContact: residentForm.guardianContact || selectedStudentContact,
        messFood: residentForm.messFood,
        emergencyContact: residentForm.emergencyContact,
        notes: residentForm.notes,
        status: 'active',
      });
      setResidentForm(initialResidentForm);
      setShowAllotmentForm(false);
      setFormErrors({});
      await refreshData();
    } catch (error) {
      setFormErrors(error.fieldErrors || {});
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
    if (!window.confirm('Vacate this student from hostel room?')) return;
    try {
      await hostelApi.vacateResident(residentId);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to vacate hostel allotment.');
    }
  };

  const updateMessMenuMeal = (rowId, mealName) => {
    setMessMenuRows((current) => current.map((row) => (
      row.id === rowId ? { ...row, mealName: mealName.toUpperCase() } : row
    )));
  };

  const updateMessMenuCell = (rowId, menuType, day, value) => {
    setMessMenuRows((current) => current.map((row) => (
      row.id === rowId
        ? { ...row, [menuType]: { ...row[menuType], [day]: value.toUpperCase() } }
        : row
    )));
  };

  const addMessMenuRow = () => {
    setMessMenuRows((current) => [...current, createMessMenuRow(`meal-${Date.now()}`, '')]);
  };

  const deleteMessMenuRow = (rowId) => {
    setMessMenuRows((current) => current.length > 1 ? current.filter((row) => row.id !== rowId) : current);
  };

  const saveMessMenu = () => {
    saveMessMenuRows(messMenuRows);
    setLoadError('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Hostel Management</p>
              <h1 className="truncate font-serif text-2xl font-black italic tracking-tight text-slate-950">
                {activeSection ? sectionTitle(activeSection) : 'Hostel Workspace'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        {loadError ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        {!activeSection ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {workspaceCards.map((card) => (
                <WorkspaceCard
                  key={card.key}
                  icon={card.icon}
                  title={card.title}
                  text={card.text}
                  onClick={() => {
                    setActiveSection(card.key);
                    setFormErrors({});
                  }}
                />
              ))}
          </section>
        ) : null}

        {activeSection === 'hostels' ? (
          <Panel title="Hostel Management" description="Create hostel details and review all hostel records below.">
            <form className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleHostelSave}>
              <InputField label="Hostel Name" value={hostelForm.hostelName} onChange={(e) => updateHostelForm('hostelName', e.target.value)} placeholder="Enter hostel name" error={formErrors.hostelName} />
              <SelectField label="Hostel Type" value={hostelForm.hostelType} onChange={(e) => updateHostelForm('hostelType', e.target.value)} options={['boys', 'girls']} error={formErrors.hostelType} />
              <InputField label="Total Floors" type="number" min="1" value={hostelForm.totalFloors} onChange={(e) => updateHostelForm('totalFloors', e.target.value)} error={formErrors.totalFloors} />
              <InputField label="Warden Name" value={hostelForm.wardenName} onChange={(e) => updateHostelForm('wardenName', e.target.value)} placeholder="Enter warden name" error={formErrors.wardenName} />
              <InputField label="Contact Number" value={hostelForm.contactNumber} onChange={(e) => updateHostelForm('contactNumber', digitsOnly(e.target.value, 10))} placeholder="Enter contact number" error={formErrors.contactNumber} />
              <SelectField label="Status" value={hostelForm.status} onChange={(e) => updateHostelForm('status', e.target.value)} options={['active', 'inactive']} error={formErrors.status} />
              <div className="md:col-span-2 xl:col-span-3">
                <PrimaryButton type="submit" icon={HousePlus} label={isSaving ? 'Saving Hostel...' : 'Save Hostel'} />
              </div>
            </form>

            <RegisterHeader title="Hostel Register" count={`${filteredHostels.length} hostel(s)`} search={<SearchInput value={hostelSearch} onChange={setHostelSearch} placeholder="Search hostel, type, warden, contact..." />} />
            {filteredHostels.length ? (
              <ExcelTable>
                <table className="min-w-full border-collapse bg-white">
                  <thead>
                    <tr className="bg-emerald-50">
                      <Th>Hostel Name</Th>
                      <Th>Type</Th>
                      <Th>Floors</Th>
                      <Th>Warden</Th>
                      <Th>Contact</Th>
                      <Th>Rooms</Th>
                      <Th>Total Beds</Th>
                      <Th>Vacant Beds</Th>
                      <Th>Status</Th>
                      <Th noBorder>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHostels.map((hostel) => (
                      <tr key={hostel.id} className="odd:bg-white even:bg-slate-50">
                        <Td>{hostel.hostelName || '-'}</Td>
                        <Td>{hostel.hostelType || '-'}</Td>
                        <Td>{hostel.totalFloors || 0}</Td>
                        <Td>{hostel.wardenName || '-'}</Td>
                        <Td>{hostel.contactNumber || '-'}</Td>
                        <Td>{hostel.totalRooms || 0}</Td>
                        <Td>{hostel.totalBeds || 0}</Td>
                        <Td>{hostel.vacantBeds || 0}</Td>
                        <Td><StatusBadge text={hostel.status || 'active'} /></Td>
                        <Td noBorder><IconButton icon={Trash2} onClick={() => handleDeleteHostel(hostel.id)} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ExcelTable>
            ) : (
              <EmptyState icon={Hotel} title="No Hostel Created" description="Create the first hostel to begin room management." />
            )}
          </Panel>
        ) : null}

        {activeSection === 'rooms' ? (
          <Panel
            title="Room Management"
            description="Create hostel rooms, capacity, charges, and bed availability."
            action={(
              <button
                type="button"
                onClick={() => {
                  setActiveSection('room-generator');
                  setFormErrors({});
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-700"
              >
                <Building2 size={15} />
                Room Generate
              </button>
            )}
          >
            <div className="mt-6">
              {hostels.length ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {hostels.map((hostel) => (
                    <button
                      key={hostel.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoomHostelId(String(hostel.id));
                        setSelectedRoomFloor('');
                        setSelectedAllotmentRoomId('');
                        setShowAllotmentForm(false);
                        setBulkRoomForm((current) => ({ ...current, hostelId: String(hostel.id), floorNumber: '' }));
                      }}
                      className={`rounded-2xl border p-5 text-left transition ${
                        String(selectedRoomHostelId) === String(hostel.id)
                          ? 'border-emerald-300 bg-emerald-50 shadow-[0_18px_45px_-35px_rgba(16,185,129,0.7)]'
                          : 'border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-black text-slate-950">{hostel.hostelName || 'Hostel'}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{hostel.hostelType || 'hostel'}</p>
                        </div>
                        <StatusBadge text={`${hostel.totalFloors || 0} floors`} />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <MiniMetric label="Rooms" value={hostel.totalRooms || 0} />
                        <MiniMetric label="Beds" value={hostel.totalBeds || 0} />
                        <MiniMetric label="Vacant" value={hostel.vacantBeds || 0} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Hotel} title="No Hostel Created" description="Create a hostel first, then manage rooms floor-wise." />
              )}
            </div>

            {selectedRoomHostel ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-xl font-black tracking-tight text-slate-950">{selectedRoomHostel.hostelName}</h4>
                    <p className="mt-1 text-sm text-slate-500">Select floor to see room-wise student count and full/vacant status.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                    {selectedFloorRooms.length} room(s)
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedHostelFloorOptions.map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => {
                        setSelectedRoomFloor(floor);
                        setSelectedAllotmentRoomId('');
                        setShowAllotmentForm(false);
                        setBulkRoomForm((current) => ({ ...current, hostelId: String(selectedRoomHostel.id), floorNumber: floor }));
                      }}
                      className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                        String(selectedRoomFloor) === String(floor)
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                      }`}
                    >
                      Floor {floor}
                    </button>
                  ))}
                </div>

                {selectedRoomFloor ? (
                  selectedFloorRooms.length ? (
                    <ExcelTable>
                      <table className="min-w-full border-collapse bg-white">
                        <thead>
                          <tr className="bg-emerald-50">
                            <Th>Room</Th>
                            <Th>Floor</Th>
                            <Th>Students Per Room</Th>
                            <Th>Students In Room</Th>
                            <Th>Vacant Seat</Th>
                            <Th>AC</Th>
                            <Th>Status</Th>
                            <Th>Add Student</Th>
                            <Th noBorder>Action</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedFloorRooms.map((room) => {
                            const vacantBeds = getVacantBeds(room);
                            const isFull = vacantBeds <= 0;
                            return (
                              <tr key={room.id} className="odd:bg-white even:bg-slate-50">
                                <Td>{room.roomNumber || '-'}</Td>
                                <Td>{room.floorLabel || '-'}</Td>
                                <Td>{room.capacity || 0}</Td>
                                <Td><OccupancyBadge occupied={room.occupiedBeds} capacity={room.capacity} /></Td>
                                <Td>{vacantBeds}</Td>
                                <Td>{room.acType || '-'}</Td>
                                <Td><StatusBadge text={isFull ? 'Full' : 'Available'} /></Td>
                                <Td>
                                  <button
                                    type="button"
                                    disabled={isFull}
                                    onClick={() => openAllotmentFormForRoom(room)}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                                  >
                                    <UserPlus size={14} />
                                    Add
                                  </button>
                                </Td>
                                <Td noBorder><IconButton icon={Trash2} onClick={() => handleDeleteRoom(room.id)} /></Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </ExcelTable>
                  ) : (
                    <EmptyState icon={Building2} title="No Rooms On This Floor" description="Generate a room range for this floor to see room status here." />
                  )
                ) : (
                  <EmptyState icon={Building2} title="Select Floor" description="Choose a floor above to view each room and its student status." />
                )}

                {selectedAllotmentRoom ? (
                  <div className="mt-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="text-xl font-black tracking-tight text-slate-950">
                            {selectedAllotmentRoom.hostelName} - Room {selectedAllotmentRoom.roomNumber}
                          </h4>
                          <p className="mt-1 text-sm text-slate-500">Student add form and current room resident list.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <MiniMetric label="Capacity" value={selectedAllotmentRoom.capacity || 0} />
                          <MiniMetric label="Filled" value={activeSelectedRoomResidents.length} />
                          <MiniMetric label="Vacant" value={getVacantBeds(selectedAllotmentRoom)} />
                        </div>
                      </div>

                      {showAllotmentForm ? (
                        <form className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleResidentSave}>
                          <SelectField label="Class" value={residentForm.className} onChange={(e) => updateResidentForm({ className: e.target.value, section: '', studentId: '', guardianContact: '' })} options={['', ...classOptions]} renderOptionLabel={(value) => value || 'Select class'} error={formErrors.className} />
                          <SelectField label="Section" value={residentForm.section} onChange={(e) => updateResidentForm({ section: e.target.value, studentId: '', guardianContact: '' })} options={['', ...sectionOptions]} renderOptionLabel={(value) => value || 'Select section'} error={formErrors.section} />
                          <SelectField label="Student" value={residentForm.studentId} onChange={(e) => updateResidentForm({ studentId: e.target.value, guardianContact: studentContact(e.target.value, students) })} options={['', ...filteredStudentOptions.map((student) => String(student.id))]} renderOptionLabel={(value) => studentLabel(value, filteredStudentOptions)} error={formErrors.studentId} />
                          <InputField label="Bed Number" value={residentForm.bedNumber} onChange={(e) => updateResidentForm({ bedNumber: e.target.value.toUpperCase() })} placeholder="Leave blank for auto" error={formErrors.bedNumber} />
                          <InputField label="Joining Date" type="date" value={residentForm.checkInDate} onChange={(e) => updateResidentForm({ checkInDate: e.target.value })} error={formErrors.checkInDate} />
                          <InputField label="Father Contact" value={residentForm.guardianContact || selectedStudentContact} onChange={(e) => updateResidentForm({ guardianContact: digitsOnly(e.target.value, 10) })} placeholder="Auto fetched from admission" error={formErrors.guardianContact} />
                          <SelectField label="Mess Food" value={residentForm.messFood} onChange={(e) => updateResidentForm({ messFood: e.target.value })} options={MESS_FOOD_OPTIONS} renderOptionLabel={messFoodLabel} error={formErrors.messFood} />
                          <InputField label="Emergency Contact" value={residentForm.emergencyContact} onChange={(e) => updateResidentForm({ emergencyContact: digitsOnly(e.target.value, 10) })} placeholder="Enter emergency contact" error={formErrors.emergencyContact} />
                          <InputField label="Notes" value={residentForm.notes} onChange={(e) => updateResidentForm({ notes: e.target.value.toUpperCase() })} placeholder="Enter notes or special instruction" error={formErrors.notes} wide />
                          <div className="md:col-span-2 xl:col-span-3">
                            <PrimaryButton type="submit" icon={UserPlus} label={isSaving ? 'Saving Allotment...' : 'Save Allotment'} />
                          </div>
                        </form>
                      ) : null}
                    </div>

                    {selectedRoomResidents.length ? (
                      <ExcelTable>
                        <table className="min-w-full border-collapse bg-white">
                          <thead>
                            <tr className="bg-emerald-50">
                              <Th>Student</Th>
                              <Th>Class</Th>
                              <Th>Section</Th>
                              <Th>Bed</Th>
                              <Th>Join Date</Th>
                              <Th>Vacate Date</Th>
                              <Th>Status</Th>
                              <Th>Mess Food</Th>
                              <Th>Contact</Th>
                              <Th noBorder>Action</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRoomResidents.map((resident) => (
                              <tr key={resident.id} className="odd:bg-white even:bg-slate-50">
                                <Td>{resident.studentName || '-'}</Td>
                                <Td>{resident.className || '-'}</Td>
                                <Td>{resident.section || '-'}</Td>
                                <Td>{resident.bedNumber || 'Auto'}</Td>
                                <Td>{resident.checkInDate || '-'}</Td>
                                <Td>{resident.checkOutDate || '-'}</Td>
                                <Td><StatusBadge text={resident.status || 'active'} /></Td>
                                <Td>{messFoodLabel(resident.messFood)}</Td>
                                <Td>{resident.guardianContact || resident.emergencyContact || '-'}</Td>
                                <Td noBorder>
                                  {isActiveResident(resident) ? <IconButton icon={Trash2} onClick={() => handleDeleteResident(resident.id)} /> : '-'}
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ExcelTable>
                    ) : (
                      <EmptyState icon={Users} title="No Student In This Room" description="Use Add Student to allot a student to this room." />
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {activeSection === 'room-generator' ? (
          <Panel title="Generate Rooms" description="Use room range for selected hostel floor. Different floors can have different ranges.">
            <form className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleGenerateRooms}>
              <SelectField
                label="Hostel"
                value={bulkRoomForm.hostelId}
                onChange={(e) => {
                  updateBulkRoomForm('hostelId', e.target.value);
                  setSelectedRoomHostelId(e.target.value);
                  setSelectedRoomFloor('');
                  setBulkRoomForm((current) => ({ ...current, hostelId: e.target.value, floorNumber: '' }));
                }}
                options={['', ...hostels.map((hostel) => String(hostel.id))]}
                renderOptionLabel={(value) => hostelLabel(value, hostels)}
                error={formErrors.hostelId}
              />
              <SelectField
                label="Floor Number"
                value={bulkRoomForm.floorNumber}
                onChange={(e) => {
                  updateBulkRoomForm('floorNumber', e.target.value);
                  setSelectedRoomFloor(e.target.value);
                }}
                options={['', ...floorOptions(bulkRoomForm.hostelId, hostels)]}
                renderOptionLabel={(value) => value ? `Floor ${value}` : 'Select floor'}
                error={formErrors.floorNumber}
              />
              <InputField label="Start Room Number" type="number" min="1" value={bulkRoomForm.startRoomNumber} onChange={(e) => updateBulkRoomForm('startRoomNumber', e.target.value)} error={formErrors.startRoomNumber} />
              <InputField label="End Room Number" type="number" min="1" value={bulkRoomForm.endRoomNumber} onChange={(e) => updateBulkRoomForm('endRoomNumber', e.target.value)} error={formErrors.endRoomNumber} />
              <InputField label="Students Per Room" type="number" min="1" value={bulkRoomForm.capacity} onChange={(e) => updateBulkRoomForm('capacity', e.target.value)} error={formErrors.capacity} />
              <SelectField label="AC Type" value={bulkRoomForm.acType} onChange={(e) => updateBulkRoomForm('acType', e.target.value)} options={['ac', 'non-ac']} error={formErrors.acType} />
              <div className="md:col-span-2 xl:col-span-4">
                <PrimaryButton type="submit" icon={Building2} label="Generate Rooms" />
              </div>
            </form>

            {formErrors.preview ? <p className="mt-3 text-xs font-bold text-rose-600">{formErrors.preview}</p> : null}

            {bulkRoomPreview.length ? (
              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-lg font-black text-slate-950">Generated Room Preview</h4>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{bulkRoomPreview.length} room(s) ready to save</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGeneratedRooms}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-700"
                  >
                    <Building2 size={15} />
                    {isSaving ? 'Saving Rooms...' : 'Save All Rooms'}
                  </button>
                </div>
                <ExcelTable>
                  <table className="min-w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-emerald-50">
                        <Th>Hostel</Th>
                        <Th>Floor</Th>
                        <Th>Room</Th>
                        <Th>Students Per Room</Th>
                        <Th>AC</Th>
                        <Th noBorder>Action</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRoomPreview.map((room) => (
                        <tr key={room.previewId} className="odd:bg-white even:bg-slate-50">
                          <Td>{room.hostelName}</Td>
                          <Td>{room.floorLabel}</Td>
                          <Td>{room.roomNumber}</Td>
                          <Td>{room.capacity}</Td>
                          <Td>{room.acType}</Td>
                          <Td noBorder><IconButton icon={Trash2} onClick={() => setBulkRoomPreview((current) => current.filter((entry) => entry.previewId !== room.previewId))} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ExcelTable>
              </div>
            ) : null}
          </Panel>
        ) : null}

        {activeSection === 'mess-food' ? (
          <Panel
            title="Mess Food Management"
            description="Create weekly food timetable for every meal with separate vegetarian and non-vegetarian menus."
            action={(
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addMessMenuRow}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                >
                  <Plus size={15} />
                  Add Meal
                </button>
                <button
                  type="button"
                  onClick={saveMessMenu}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-700"
                >
                  <Save size={15} />
                  Save Menu
                </button>
              </div>
            )}
          >
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Total Students" value={messFoodStats.total} tone="slate" />
              <SummaryCard label="Vegetarian" value={messFoodStats.vegetarian} tone="emerald" />
              <SummaryCard label="Non-Vegetarian" value={messFoodStats.nonVegetarian} tone="rose" />
              <SummaryCard label="Select Pending" value={messFoodStats.pending} tone="amber" />
            </div>

            <div className="mt-8 grid gap-8">
              {MESS_MENU_TYPES.map((menuType) => (
                <MessMenuTable
                  key={menuType.key}
                  menuType={menuType}
                  rows={messMenuRows}
                  onMealChange={updateMessMenuMeal}
                  onCellChange={updateMessMenuCell}
                  onDeleteRow={deleteMessMenuRow}
                />
              ))}
            </div>
          </Panel>
        ) : null}

      </main>
    </div>
  );
};

const WorkspaceCard = ({ icon: Icon, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-48 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-[0_18px_55px_-42px_rgba(15,23,42,0.5)] transition hover:-translate-y-1 hover:border-emerald-300"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
        <Icon size={24} />
      </div>
      <ArrowRight size={18} className="text-slate-300 transition group-hover:text-emerald-600" />
    </div>
    <div>
      <h3 className="mt-6 font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  </button>
);

const Panel = ({ title, description, action, children }) => (
  <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-42px_rgba(15,23,42,0.55)] lg:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children}
  </section>
);

const RegisterHeader = ({ title, count, search }) => (
  <div className="mt-10 border-t border-slate-200 pt-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h4 className="text-xl font-black tracking-tight text-slate-950">{title}</h4>
        <p className="mt-1 text-sm text-slate-500">Saved data appears below in row and column format.</p>
      </div>
      <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">{count}</div>
    </div>
    <div className="mt-4">{search}</div>
  </div>
);

const MessMenuTable = ({ menuType, rows, onMealChange, onCellChange, onDeleteRow }) => {
  const headerClass = menuType.tone === 'rose' ? 'bg-rose-50' : 'bg-emerald-50';

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-xl font-black tracking-tight text-slate-950">{menuType.title}</h4>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
          {rows.length} meal row(s)
        </div>
      </div>
      <ExcelTable>
        <table className="w-max min-w-full border-collapse bg-white">
          <thead>
            <tr className={headerClass}>
              <StickyTh>Meal Time</StickyTh>
              {MESS_MENU_DAYS.map((day) => (
                <Th key={`${menuType.key}-${day}`}>{day}</Th>
              ))}
              <Th noBorder>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-slate-50">
                <StickyEditableTd>
                  <input
                    value={row.mealName}
                    onChange={(event) => onMealChange(row.id, event.target.value)}
                    placeholder="BREAKFAST"
                    className="min-h-12 w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:w-40"
                  />
                </StickyEditableTd>
                {MESS_MENU_DAYS.map((day) => (
                  <EditableTd key={`${row.id}-${menuType.key}-${day}`}>
                    <textarea
                      value={row[menuType.key]?.[day] || ''}
                      onChange={(event) => onCellChange(row.id, menuType.key, day, event.target.value)}
                      placeholder="Food items"
                      className="min-h-20 w-32 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:w-36"
                    />
                  </EditableTd>
                ))}
                <Td noBorder>
                  <IconButton icon={Trash2} onClick={() => onDeleteRow(row.id)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </ExcelTable>
    </div>
  );
};

const InputField = ({ label, error, wide = false, ...props }) => (
  <div className={`space-y-2.5 ${wide ? 'md:col-span-2 xl:col-span-3' : ''}`}>
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white ${
        error ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100' : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
      }`}
      {...props}
    />
    {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
  </div>
);

const SelectField = ({ label, options, renderOptionLabel, error, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white ${
        error ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100' : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
      }`}
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
        </option>
      ))}
    </select>
    {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
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
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <Icon size={15} />
    {label}
  </button>
);

const ExcelTable = ({ children }) => (
  <div className="mt-6 min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200">
    <div className="max-w-full overflow-x-auto">{children}</div>
  </div>
);

const Th = ({ children, noBorder = false }) => (
  <th className={`border-b border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 ${noBorder ? '' : 'border-r'}`}>
    {children}
  </th>
);

const StickyTh = ({ children }) => (
  <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-inherit px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-[8px_0_14px_-14px_rgba(15,23,42,0.7)]">
    {children}
  </th>
);

const Td = ({ children, noBorder = false }) => (
  <td className={`border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 ${noBorder ? '' : 'border-r'}`}>
    {children}
  </td>
);

const StickyEditableTd = ({ children }) => (
  <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-2 align-top shadow-[8px_0_14px_-14px_rgba(15,23,42,0.7)]">
    {children}
  </td>
);

const EditableTd = ({ children }) => (
  <td className="border-b border-r border-slate-200 p-2 align-top">
    {children}
  </td>
);

const MiniMetric = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-1 text-base font-black text-slate-950">{value}</p>
  </div>
);

const SummaryCard = ({ label, value, tone }) => {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
};

const OccupancyBadge = ({ occupied, capacity }) => {
  const occupiedCount = Number(occupied) || 0;
  const capacityCount = Number(capacity) || 0;
  const isFull = capacityCount > 0 && occupiedCount >= capacityCount;
  const isEmpty = occupiedCount <= 0;
  const colorClass = isEmpty
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : isFull
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <span className={`inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-xs font-black ${colorClass}`}>
      {occupiedCount}
    </span>
  );
};

const StatusBadge = ({ text }) => (
  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
    {text}
  </span>
);

const MessFoodBadge = ({ value }) => {
  const normalizedValue = normalizeMessFood(value);
  const colorClass = {
    vegetarian: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'non-vegetarian': 'border-rose-200 bg-rose-50 text-rose-700',
    select: 'border-amber-200 bg-amber-50 text-amber-700',
  }[normalizedValue];

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${colorClass}`}>
      {messFoodLabel(normalizedValue)}
    </span>
  );
};

const IconButton = ({ icon: Icon, onClick }) => (
  <button type="button" onClick={onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
    <Icon size={16} />
  </button>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
      <Icon size={30} />
    </div>
    <h4 className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

function sectionTitle(section) {
  return {
    hostels: 'Hostel Management',
    rooms: 'Room Management',
    'room-generator': 'Generate Rooms',
    'mess-food': 'Mess Food Management',
  }[section] || 'Hostel Workspace';
}

function filterRecords(records, query, fields) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return records;
  return records.filter((record) => fields.some((field) => String(record[field] || '').toLowerCase().includes(normalizedQuery)));
}

function validateHostelForm(form) {
  const errors = {};
  if (!String(form.hostelName || '').trim()) errors.hostelName = 'Hostel name is required.';
  if (!form.hostelType) errors.hostelType = 'Select hostel type.';
  if ((Number(form.totalFloors) || 0) < 1) errors.totalFloors = 'Total floors must be at least 1.';
  if (form.contactNumber && !/^\d{10}$/.test(form.contactNumber)) errors.contactNumber = 'Contact number must contain 10 digits.';
  return errors;
}

function validateBulkRoomForm(form) {
  const errors = {};
  const floorNumber = Number(form.floorNumber);
  const startRoomNumber = Number(form.startRoomNumber);
  const endRoomNumber = Number(form.endRoomNumber);
  if (!form.hostelId) errors.hostelId = 'Select hostel.';
  if (!Number.isInteger(floorNumber) || floorNumber < 1) errors.floorNumber = 'Select floor number.';
  if (!Number.isInteger(startRoomNumber) || startRoomNumber < 1) errors.startRoomNumber = 'Start room number must be at least 1.';
  if (!Number.isInteger(endRoomNumber) || endRoomNumber < startRoomNumber) errors.endRoomNumber = 'End room number must be same or greater than start room number.';
  if (endRoomNumber - startRoomNumber + 1 > 300) errors.endRoomNumber = 'Generate 300 rooms or fewer at a time.';
  if ((Number(form.capacity) || 0) < 1) errors.capacity = 'Students per room must be at least 1.';
  return errors;
}

function validateResidentForm(form) {
  const errors = {};
  if (!form.className) errors.className = 'Select class.';
  if (!form.section) errors.section = 'Select section.';
  if (!form.studentId) errors.studentId = 'Select student.';
  if (!form.roomId) errors.roomId = 'Select room.';
  if (!form.checkInDate) errors.checkInDate = 'Joining date is required.';
  if (form.guardianContact && !/^\d{10}$/.test(form.guardianContact)) errors.guardianContact = 'Guardian contact must contain 10 digits.';
  if (form.emergencyContact && !/^\d{10}$/.test(form.emergencyContact)) errors.emergencyContact = 'Emergency contact must contain 10 digits.';
  return errors;
}

function generateRoomPreview(form, hostels) {
  const hostel = hostels.find((entry) => String(entry.id) === String(form.hostelId));
  const floorNumber = Number(form.floorNumber);
  const startRoomNumber = Number(form.startRoomNumber);
  const endRoomNumber = Number(form.endRoomNumber);
  const rows = [];

  for (let roomSuffix = startRoomNumber; roomSuffix <= endRoomNumber; roomSuffix += 1) {
    const roomNumber = `${floorNumber}${String(roomSuffix).padStart(2, '0')}`;
    rows.push({
      previewId: `${form.hostelId}-${floorNumber}-${roomNumber}`,
      hostelId: Number(form.hostelId),
      hostelName: hostel?.hostelName || 'Hostel',
      roomNumber,
      floorLabel: String(floorNumber),
      capacity: Math.max(Number(form.capacity) || 1, 1),
      acType: form.acType,
    });
  }

  return rows;
}

function createMessMenuRow(id, mealName) {
  return {
    id,
    mealName,
    vegetarian: emptyMessMenuCells(),
    nonVegetarian: emptyMessMenuCells(),
  };
}

function emptyMessMenuCells() {
  return MESS_MENU_DAYS.reduce((cells, day) => ({ ...cells, [day]: '' }), {});
}

function defaultMessMenuRows() {
  return [
    createMessMenuRow('breakfast', 'BREAKFAST'),
    createMessMenuRow('lunch', 'LUNCH'),
    createMessMenuRow('dinner', 'DINNER'),
  ];
}

function loadMessMenuRows() {
  if (typeof window === 'undefined') return defaultMessMenuRows();

  try {
    const savedRows = JSON.parse(window.localStorage.getItem(messMenuStorageKey()) || 'null');
    return Array.isArray(savedRows) && savedRows.length
      ? savedRows.map(normalizeMessMenuRow)
      : defaultMessMenuRows();
  } catch {
    return defaultMessMenuRows();
  }
}

function saveMessMenuRows(rows) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(messMenuStorageKey(), JSON.stringify(rows.map(normalizeMessMenuRow)));
}

function messMenuStorageKey() {
  const collegeId = typeof window === 'undefined' ? '' : window.localStorage.getItem('current_college_id');
  return `hostel_mess_menu_${collegeId || 'default'}`;
}

function normalizeMessMenuRow(row) {
  return {
    id: row?.id || `meal-${Date.now()}`,
    mealName: String(row?.mealName || '').trim().toUpperCase(),
    vegetarian: normalizeMessMenuCells(row?.vegetarian),
    nonVegetarian: normalizeMessMenuCells(row?.nonVegetarian),
  };
}

function normalizeMessMenuCells(cells = {}) {
  return MESS_MENU_DAYS.reduce((nextCells, day) => ({
    ...nextCells,
    [day]: String(cells?.[day] || '').trim().toUpperCase(),
  }), {});
}

function shouldUppercase(field) {
  return ['hostelName', 'wardenName', 'roomNumber'].includes(field);
}

function normalizeFloorValue(value) {
  const text = String(value || '').trim();
  const match = text.match(/\d+/);
  return match ? match[0] : text;
}

function floorOptions(hostelId, hostels) {
  const hostel = hostels.find((entry) => String(entry.id) === String(hostelId));
  const totalFloors = Math.max(Number(hostel?.totalFloors) || 0, 0);
  return Array.from({ length: totalFloors }, (_, index) => String(index + 1));
}

function digitsOnly(value, limit) {
  return String(value || '').replace(/\D/g, '').slice(0, limit);
}

function roomCharge(room) {
  return room?.monthlyCharge ? String(room.monthlyCharge) : '';
}

function getVacantBeds(room) {
  return Math.max((Number(room?.capacity) || 0) - (Number(room?.occupiedBeds) || 0), 0);
}

function isActiveResident(resident) {
  return String(resident?.status || 'active').toLowerCase() === 'active' && !resident?.checkOutDate;
}

function hostelLabel(value, hostels) {
  if (!value) return 'Select hostel';
  const hostel = hostels.find((entry) => String(entry.id) === String(value));
  return hostel ? `${hostel.hostelName} | ${hostel.hostelType}` : 'Select hostel';
}

function studentLabel(value, students) {
  if (!value) return 'Select student';
  const student = students.find((entry) => String(entry.id) === String(value));
  return student ? `${studentName(student)} | ${getStudentClass(student) || '-'} | ${student.section || '-'}` : 'Select student';
}

function studentName(student) {
  return `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || student?.enrollmentNo || 'Student';
}

function studentContact(studentId, students) {
  const student = students.find((entry) => String(entry.id) === String(studentId));
  return digitsOnly(student?.guardianPhone || student?.fatherMobile || student?.mobileNumber || '', 10);
}

function normalizeMessFood(value) {
  const normalizedValue = String(value || 'select').toLowerCase();
  return MESS_FOOD_OPTIONS.includes(normalizedValue) ? normalizedValue : 'select';
}

function messFoodLabel(value) {
  return {
    select: 'Select',
    vegetarian: 'Vegetarian',
    'non-vegetarian': 'Non-Vegetarian',
  }[String(value || 'select').toLowerCase()] || 'Select';
}

function getStudentClass(student) {
  return student?.className || student?.assignedClass || '';
}

export default HostelManagement;
