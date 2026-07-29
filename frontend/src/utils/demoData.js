const buildStudent = ({
  id,
  firstName,
  lastName,
  gender,
  email,
  mobile,
  regDate,
  dob,
  bloodGroup,
  address,
  guardianName,
  guardianPhone,
  prevSchool,
  category,
  admissionDate,
  enrollmentNo,
  assignedClass,
  admissionCategory,
  transportOptIn = false,
  hostelOptIn = false,
  libraryOptIn = false,
  transportStatus = 'inactive',
  hostelStatus = 'inactive',
  libraryStatus = 'inactive',
  libraryMonthlyCharge = '0',
  documentNames,
  photoUrl,
  studentPortalPassword = 'student123',
}) => ({
  id,
  firstName,
  lastName,
  dob,
  gender,
  email,
  mobile,
  regDate,
  bloodGroup,
  address,
  guardianName,
  guardianPhone,
  prevSchool,
  category,
  admissionDate,
  enrollmentNo,
  assignedClass,
  admissionCategory,
  transportOptIn,
  hostelOptIn,
  libraryOptIn,
  transportStatus,
  hostelStatus,
  libraryStatus,
  libraryMonthlyCharge,
  studentPortalPassword,
  documentType: '',
  otherDocumentName: '',
  fileUploadPath: '',
  documents: documentNames.map((documentType, index) => ({
    id: id * 100 + index + 1,
    documentType,
    fileUploadPath: `${documentType.toLowerCase().replace(/\s+/g, '-')}-${enrollmentNo}.pdf`,
  })),
  qrCodeData: `EDU-${id}-${enrollmentNo}`,
  cardExpiryDate: '2027-03-31',
  photoUrl,
  systemId: `EDU-${id}`,
  status: 'Verified',
  createdAt: `${regDate}T09:00:00.000Z`,
  facilities: {
    transport: {
      requested: Boolean(transportOptIn),
      active: transportStatus === 'active',
      status: transportStatus,
    },
    hostel: {
      requested: Boolean(hostelOptIn),
      active: hostelStatus === 'active',
      status: hostelStatus,
    },
    library: {
      requested: Boolean(libraryOptIn),
      active: libraryStatus === 'active',
      status: libraryStatus,
      monthlyCharge: libraryMonthlyCharge,
    },
  },
});

const buildTeacher = ({
  id,
  firstName,
  lastName,
  personalEmail,
  mobileNumber,
  employeeId,
  teacherPortalPassword = 'teacher123',
  specialization,
  experienceYears,
  contractType,
  leaveBalance,
  salary = '',
  joiningDate = '2026-04-01',
  paymentHistory = [],
  documentNames,
  photoUrl,
  assignedClass = '',
}) => ({
  id,
  firstName,
  lastName,
  personalEmail,
  mobileNumber,
  employeeId,
  teacherPortalPassword,
  specialization,
  experienceYears,
  contractType,
  leaveBalance,
  salary,
  joiningDate,
  paymentHistory,
  assignedClass,
  documentType: '',
  otherDocumentName: '',
  fileUploadPath: '',
  documents: documentNames.map((documentType, index) => ({
    id: id * 100 + index + 1,
    documentType,
    fileUploadPath: `${documentType.toLowerCase().replace(/\s+/g, '-')}-${employeeId}.pdf`,
  })),
  qrCodeData: `TCH-${employeeId}-${mobileNumber}`,
  cardExpiryDate: '2027-03-31',
  photoUrl,
  teacherSystemId: `TCH-${employeeId}`,
  status: 'Active',
  attendanceStatus: 'Present',
  createdAt: '2026-04-01T09:30:00.000Z',
});

const buildDriver = ({
  id,
  driverName,
  driverPhone,
  driverLicense,
  salary,
  busNumber,
  routeName,
  vehicleType,
  seatCapacity,
  pickupPoints,
}) => ({
  id,
  driverName,
  driverPhone,
  driverLicense,
  salary,
  busNumber,
  routeName,
  vehicleType,
  seatCapacity,
  pickupPoints,
  status: 'Active',
  routeCode: `ROUTE-${routeName.trim().replace(/\s+/g, '-').toUpperCase()}`,
  createdAt: '2026-04-01T10:00:00.000Z',
});

const buildTransportStudent = ({
  id,
  studentId,
  studentName,
  className,
  pickupStop,
  assignedDriverId,
  driverName,
  busNumber,
  routeName,
}) => ({
  id,
  studentId,
  studentName,
  className,
  pickupStop,
  assignedDriverId,
  driverName,
  busNumber,
  routeName,
  createdAt: '2026-04-10T08:00:00.000Z',
});

const buildAttendanceRecord = ({
  id,
  date,
  lectureNumber,
  subject,
  markedBy,
  className,
  studentId,
  rollNo,
  studentName,
  status,
}) => ({
  id,
  createdAt: `${date}T08:30:00.000Z`,
  date,
  lectureNumber,
  subject,
  markedBy,
  className,
  studentId,
  rollNo,
  studentName,
  status,
});

const studentFirstNames = [
  'Aarav', 'Aanya', 'Aditya', 'Anaya', 'Arjun', 'Bhavya', 'Charvi', 'Daksh',
  'Diya', 'Eshan', 'Fatima', 'Gauri', 'Harsh', 'Ishita', 'Kabir', 'Kiara',
  'Laksh', 'Mahika', 'Myra', 'Navya', 'Om', 'Pari', 'Pranav', 'Riya',
  'Saanvi', 'Shivansh', 'Tanvi', 'Utkarsh', 'Vihaan', 'Yashika',
];

const studentLastNames = [
  'Sharma', 'Verma', 'Gupta', 'Tiwari', 'Singh', 'Mishra', 'Yadav', 'Khan',
  'Agarwal', 'Srivastava', 'Joshi', 'Iyer', 'Kapoor', 'Bhardwaj', 'Saxena',
  'Chauhan', 'Pandey', 'Nigam', 'Rastogi', 'Dubey',
];

const guardianFirstNames = [
  'Rajesh', 'Sanjay', 'Amit', 'Rakesh', 'Vijay', 'Anil', 'Suresh', 'Manoj',
  'Deepak', 'Pradeep', 'Mukesh', 'Nitin', 'Sunil', 'Vinod', 'Rahul',
];

const teacherFirstNames = [
  'Sonal', 'Rahul', 'Nidhi', 'Pankaj', 'Kiran', 'Meenal', 'Anup', 'Swati',
  'Rohit', 'Pooja', 'Vivek', 'Shalini', 'Tushar', 'Neetu', 'Abhishek', 'Renu',
  'Anjali', 'Manish', 'Preeti', 'Saurabh', 'Divya', 'Mohit', 'Sneha', 'Ajay',
  'Komal', 'Alok', 'Madhuri', 'Ritika',
];

const teacherLastNames = [
  'Bhardwaj', 'Srivastava', 'Gupta', 'Tandon', 'Mishra', 'Awasthi', 'Kapoor',
  'Sharma', 'Saxena', 'Joshi', 'Verma', 'Rana', 'Agarwal', 'Kohli',
];

const schoolClassConfigs = [
  { label: 'LKG', sections: ['A', 'B', 'C'], studentCount: 14, previousSchool: 'Tiny Tots Preschool' },
  { label: 'UKG', sections: ['A', 'B', 'C'], studentCount: 14, previousSchool: 'Tiny Tots Preschool' },
  { label: 'Class 1', sections: ['A', 'B', 'C'], studentCount: 16, previousSchool: 'Sunrise Junior Wing' },
  { label: 'Class 2', sections: ['A', 'B', 'C'], studentCount: 16, previousSchool: 'Sunrise Junior Wing' },
  { label: 'Class 3', sections: ['A', 'B', 'C'], studentCount: 16, previousSchool: 'Sunrise Junior Wing' },
  { label: 'Class 4', sections: ['A', 'B', 'C'], studentCount: 18, previousSchool: 'Sunrise Junior Wing' },
  { label: 'Class 5', sections: ['A', 'B', 'C'], studentCount: 18, previousSchool: 'Sunrise Junior Wing' },
  { label: 'Class 6', sections: ['A', 'B', 'C'], studentCount: 18, previousSchool: 'Sunrise Junior Wing' },
  { label: 'Class 7', sections: ['A', 'B', 'C'], studentCount: 20, previousSchool: 'Sunrise Middle Wing' },
  { label: 'Class 8', sections: ['A', 'B', 'C'], studentCount: 20, previousSchool: 'Sunrise Middle Wing' },
  { label: 'Class 9', sections: ['A', 'B', 'C'], studentCount: 20, previousSchool: 'Sunrise Middle Wing' },
  { label: 'Class 10', sections: ['A', 'B', 'C'], studentCount: 20, previousSchool: 'Sunrise Senior Wing' },
  { label: 'Class 11', sections: ['Science', 'Commerce', 'Humanities'], studentCount: 18, previousSchool: 'Sunrise Senior Wing' },
  { label: 'Class 12', sections: ['Science', 'Commerce', 'Humanities'], studentCount: 18, previousSchool: 'Sunrise Senior Wing' },
];

const schoolSubjectCycle = [
  'Early Learning',
  'English',
  'Mathematics',
  'Environmental Studies',
  'Science',
  'Social Science',
  'Hindi',
  'Computer Science',
  'Commerce',
  'Biology',
  'Physics',
  'Chemistry',
];

const schoolRouteStops = [
  ['Gomti Nagar', 'Kathauta', 'School Gate'],
  ['Aliganj', 'Kapoorthala', 'School Gate'],
  ['Indira Nagar', 'Munshipulia', 'School Gate'],
  ['Hazratganj', 'Civil Lines', 'School Gate'],
  ['Rajajipuram', 'Talkatora', 'School Gate'],
  ['Jankipuram', 'Engineering College Chauraha', 'School Gate'],
];

const createSchoolStudents = () => {
  const students = [];
  let currentId = 1101;

  schoolClassConfigs.forEach((classConfig, classIndex) => {
    classConfig.sections.forEach((section, sectionIndex) => {
      const assignedClass = `${classConfig.label} / ${section}`;
      for (let seat = 1; seat <= classConfig.studentCount; seat += 1) {
        const firstName = studentFirstNames[(classIndex * 7 + sectionIndex * 5 + seat) % studentFirstNames.length];
        const lastName = studentLastNames[(classIndex * 5 + seat + sectionIndex) % studentLastNames.length];
        const guardianName = `${guardianFirstNames[(classIndex * 3 + seat + sectionIndex) % guardianFirstNames.length]} ${lastName}`;
        const enrollmentPrefix = classConfig.label.replace(/\s+/g, '').toUpperCase();
        const sectionCode = section.replace(/\s+/g, '').toUpperCase();
        const enrollmentNo = `${enrollmentPrefix}-${sectionCode}-${String(seat).padStart(3, '0')}`;

        students.push(buildStudent({
          id: currentId,
          firstName,
          lastName,
          gender: seat % 2 === 0 ? 'Female' : 'Male',
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${currentId}@sunrise.edu`,
          mobile: `+91 93${String(currentId).padStart(8, '0').slice(-8)}`,
          regDate: '2026-04-01',
          dob: `20${String(10 + (classIndex % 8)).padStart(2, '0')}-${String((seat % 9) + 1).padStart(2, '0')}-${String(((seat * 2) % 27) + 1).padStart(2, '0')}`,
          bloodGroup: ['A+', 'B+', 'O+', 'AB+'][seat % 4],
          address: `${section} Block, ${['Gomti Nagar', 'Aliganj', 'Indira Nagar', 'Jankipuram'][sectionIndex % 4]}, Lucknow`,
          guardianName,
          guardianPhone: `+91 83${String(currentId).padStart(8, '0').slice(-8)}`,
          prevSchool: classConfig.previousSchool,
          category: ['Gen', 'OBC', 'SC'][seat % 3],
          admissionDate: '2026-04-05',
          enrollmentNo,
          assignedClass,
          admissionCategory: 'Regular',
          transportOptIn: currentId % 3 === 0,
          hostelOptIn: false,
          transportStatus: currentId % 3 === 0 ? 'active' : 'inactive',
          hostelStatus: 'inactive',
          documentNames: ['Aadhar', 'TC'],
          photoUrl: '',
        }));

        currentId += 1;
      }
    });
  });

  return students;
};

const createSchoolTeachers = () => {
  let currentId = 2101;

  return schoolClassConfigs.flatMap((classConfig, classIndex) =>
    classConfig.sections.map((section, sectionIndex) => {
      const assignedClass = `${classConfig.label} / ${section}`;
      const firstName = teacherFirstNames[(classIndex * 2 + sectionIndex) % teacherFirstNames.length];
      const lastName = teacherLastNames[(classIndex + sectionIndex * 2) % teacherLastNames.length];
      const specialization = schoolSubjectCycle[(classIndex + sectionIndex) % schoolSubjectCycle.length];
      const teacher = buildTeacher({
        id: currentId,
        firstName,
        lastName,
        personalEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${currentId}@sunrise.edu`,
        mobileNumber: `+91 94${String(currentId).padStart(8, '0').slice(-8)}`,
        employeeId: `SCH-${currentId}`,
        specialization,
        experienceYears: String(3 + ((classIndex + sectionIndex) % 12)),
        contractType: classIndex < 10 ? 'Full Time' : sectionIndex % 2 === 0 ? 'Full Time' : 'Contractual',
        leaveBalance: String(6 + ((classIndex + sectionIndex) % 8)),
        salary: 28000 + classIndex * 750 + sectionIndex * 400,
        joiningDate: `2025-${String(((classIndex + sectionIndex) % 12) + 1).padStart(2, '0')}-01`,
        documentNames: ['Resume', 'Qualification Certificate'],
        photoUrl: '',
        assignedClass,
      });
      currentId += 1;
      return teacher;
    }),
  );
};

export const getSchoolDemoSummary = () => {
  const totalClasses = schoolClassConfigs.length;
  const totalSections = schoolClassConfigs.reduce((count, classConfig) => count + classConfig.sections.length, 0);
  const totalStudents = schoolClassConfigs.reduce(
    (count, classConfig) => count + (classConfig.sections.length * classConfig.studentCount),
    0,
  );

  return {
    totalClasses,
    totalSections,
    totalStudents,
    totalTeachers: totalSections,
  };
};

const createSchoolDrivers = () => {
  const driverNames = ['Mahesh Yadav', 'Raghav Singh', 'Pintu Maurya', 'Sanjay Rawat', 'Lokesh Pal', 'Dinesh Chauhan'];
  return driverNames.map((driverName, index) =>
    buildDriver({
      id: 3101 + index,
      driverName,
      driverPhone: `+91 95${String(10000001 + index).slice(-8)}`,
      driverLicense: `DL-UP-2026-${401 + index}`,
      salary: 16800 + index * 700,
      busNumber: `UP32 ${String.fromCharCode(65 + index)}${String.fromCharCode(70 + index)} ${9012 + index}`,
      routeName: `${['Gomti Nagar', 'Aliganj', 'Indira Nagar', 'Civil Lines', 'Rajajipuram', 'Jankipuram'][index]} Route`,
      vehicleType: index % 2 === 0 ? 'School Bus' : 'Van',
      seatCapacity: index % 2 === 0 ? '42' : '18',
      pickupPoints: schoolRouteStops[index].join(', '),
    }),
  );
};

const createSchoolTransportStudents = (students, drivers) => {
  return students
    .filter((_, index) => index % 3 === 0)
    .slice(0, 72)
    .map((student, index) => {
      const driver = drivers[index % drivers.length];
      const stops = schoolRouteStops[index % schoolRouteStops.length];
      return buildTransportStudent({
        id: 4101 + index,
        studentId: String(student.id),
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        className: student.assignedClass,
        pickupStop: stops[index % stops.length],
        assignedDriverId: driver.id,
        driverName: driver.driverName,
        busNumber: driver.busNumber,
        routeName: driver.routeName,
      });
    });
};

const createSchoolAttendance = (students, teachers) => {
  const targetClasses = ['LKG / A', 'Class 5 / B', 'Class 8 / C', 'Class 10 / A', 'Class 12 / Science'];
  let currentId = 5101;
  const records = [];

  targetClasses.forEach((className, classIndex) => {
    const classTeacher = teachers.find((teacher) => teacher.assignedClass === className) || teachers[classIndex];
    const classStudents = students.filter((student) => student.assignedClass === className).slice(0, 12);
    classStudents.forEach((student, studentIndex) => {
      records.push(buildAttendanceRecord({
        id: currentId,
        date: '2026-04-26',
        lectureNumber: String((classIndex % 4) + 1),
        subject: classTeacher?.specialization || schoolSubjectCycle[classIndex],
        markedBy: `${classTeacher?.firstName || ''} ${classTeacher?.lastName || ''}`.trim(),
        className,
        studentId: student.systemId,
        rollNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        status: studentIndex % 5 === 0 ? 'Absent' : 'Present',
      }));
      currentId += 1;
    });
  });

  return records;
};

const demoInstitutions = [
  {
    instituteName: 'Greenfield Engineering College',
    type: 'College',
    username: 'greenfield_demo',
    affiliationNo: 'AKTU-45891',
    affiliatedFrom: 'AKTU',
    contact: '+91 9876500011',
    email: 'admin@greenfield.edu',
    website: 'https://greenfield-demo.edu',
    address: 'Sector 12, Knowledge Park, Greater Noida',
    state: 'Uttar Pradesh',
    city: 'Greater Noida',
    pincode: '201310',
    password: 'demo123',
    confirmPassword: 'demo123',
    logo: null,
    id: 'greenfield_demo',
    registeredDate: '2026-04-01T08:00:00.000Z',
  },
  {
    instituteName: 'Sunrise Public School',
    type: 'School',
    username: 'sunrise_demo',
    affiliationNo: 'CBSE-22014',
    affiliatedFrom: 'CBSE',
    contact: '+91 9876500022',
    email: 'office@sunrise.edu',
    website: 'https://sunrise-demo.edu',
    address: 'Civil Lines, Phase 2, Lucknow',
    state: 'Uttar Pradesh',
    city: 'Lucknow',
    pincode: '226001',
    password: 'demo123',
    confirmPassword: 'demo123',
    logo: null,
    id: 'sunrise_demo',
    registeredDate: '2026-04-01T08:15:00.000Z',
  },
];

const greenfieldStudents = [
  buildStudent({
    id: 1001,
    firstName: 'Aarav',
    lastName: 'Singh',
    gender: 'Male',
    email: 'aarav.singh@greenfield.edu',
    mobile: '+91 9000000001',
    regDate: '2026-04-01',
    dob: '2007-05-14',
    bloodGroup: 'B+',
    address: 'Alpha 1, Greater Noida',
    guardianName: 'Rajeev Singh',
    guardianPhone: '+91 8000000001',
    prevSchool: 'Scholars Senior Secondary',
    category: 'Gen',
    admissionDate: '2026-04-02',
    enrollmentNo: '2026-BCA-001',
    assignedClass: 'BCA Semester 1',
    admissionCategory: 'Regular',
    transportOptIn: true,
    hostelOptIn: false,
    transportStatus: 'active',
    hostelStatus: 'inactive',
    documentNames: ['Aadhar', 'Marksheet'],
    photoUrl: '',
  }),
  buildStudent({
    id: 1002,
    firstName: 'Diya',
    lastName: 'Sharma',
    gender: 'Female',
    email: 'diya.sharma@greenfield.edu',
    mobile: '+91 9000000002',
    regDate: '2026-04-01',
    dob: '2007-10-05',
    bloodGroup: 'O+',
    address: 'Beta 2, Greater Noida',
    guardianName: 'Nitin Sharma',
    guardianPhone: '+91 8000000002',
    prevSchool: 'Modern Girls Inter College',
    category: 'OBC',
    admissionDate: '2026-04-03',
    enrollmentNo: '2026-BCA-002',
    assignedClass: 'BCA Semester 1',
    admissionCategory: 'Regular',
    transportOptIn: true,
    hostelOptIn: false,
    transportStatus: 'active',
    hostelStatus: 'inactive',
    documentNames: ['Aadhar', 'TC'],
    photoUrl: '',
  }),
  buildStudent({
    id: 1003,
    firstName: 'Kabir',
    lastName: 'Verma',
    gender: 'Male',
    email: 'kabir.verma@greenfield.edu',
    mobile: '+91 9000000003',
    regDate: '2026-04-02',
    dob: '2006-12-12',
    bloodGroup: 'A+',
    address: 'Gamma 1, Greater Noida',
    guardianName: 'Sanjay Verma',
    guardianPhone: '+91 8000000003',
    prevSchool: 'National Public School',
    category: 'Gen',
    admissionDate: '2026-04-04',
    enrollmentNo: '2026-BCA-003',
    assignedClass: 'BCA Semester 1',
    admissionCategory: 'Regular',
    transportOptIn: false,
    hostelOptIn: false,
    transportStatus: 'inactive',
    hostelStatus: 'inactive',
    documentNames: ['Aadhar', 'Marksheet'],
    photoUrl: '',
  }),
  buildStudent({
    id: 1004,
    firstName: 'Meera',
    lastName: 'Joshi',
    gender: 'Female',
    email: 'meera.joshi@greenfield.edu',
    mobile: '+91 9000000004',
    regDate: '2026-04-02',
    dob: '2006-08-29',
    bloodGroup: 'AB+',
    address: 'Delta 1, Greater Noida',
    guardianName: 'Vikram Joshi',
    guardianPhone: '+91 8000000004',
    prevSchool: 'St. Xavier School',
    category: 'SC',
    admissionDate: '2026-04-04',
    enrollmentNo: '2026-BTECH-014',
    assignedClass: 'B.Tech CSE / A',
    admissionCategory: 'Regular',
    transportOptIn: true,
    hostelOptIn: true,
    transportStatus: 'active',
    hostelStatus: 'active',
    documentNames: ['Aadhar', 'TC'],
    photoUrl: '',
  }),
  buildStudent({
    id: 1005,
    firstName: 'Rohan',
    lastName: 'Iyer',
    gender: 'Male',
    email: 'rohan.iyer@greenfield.edu',
    mobile: '+91 9000000005',
    regDate: '2026-04-03',
    dob: '2006-03-17',
    bloodGroup: 'O-',
    address: 'Knowledge Park, Greater Noida',
    guardianName: 'Suresh Iyer',
    guardianPhone: '+91 8000000005',
    prevSchool: 'City Montessori',
    category: 'Gen',
    admissionDate: '2026-04-05',
    enrollmentNo: '2026-BTECH-015',
    assignedClass: 'B.Tech CSE / A',
    admissionCategory: 'Lateral Entry',
    transportOptIn: false,
    hostelOptIn: true,
    transportStatus: 'inactive',
    hostelStatus: 'active',
    documentNames: ['Aadhar', 'Experience Certificate'],
    photoUrl: '',
  }),
  buildStudent({
    id: 1006,
    firstName: 'Sara',
    lastName: 'Khan',
    gender: 'Female',
    email: 'sara.khan@greenfield.edu',
    mobile: '+91 9000000006',
    regDate: '2026-04-03',
    dob: '2006-01-11',
    bloodGroup: 'B-',
    address: 'Sector Pi, Greater Noida',
    guardianName: 'Imran Khan',
    guardianPhone: '+91 8000000006',
    prevSchool: 'Delhi Public School',
    category: 'OBC',
    admissionDate: '2026-04-06',
    enrollmentNo: '2026-BCOM-021',
    assignedClass: 'B.Com / A',
    admissionCategory: 'Regular',
    transportOptIn: false,
    hostelOptIn: false,
    transportStatus: 'inactive',
    hostelStatus: 'inactive',
    documentNames: ['Aadhar', 'Marksheet'],
    photoUrl: '',
  }),
];

const greenfieldTeachers = [
  buildTeacher({
    id: 2001,
    firstName: 'Neha',
    lastName: 'Agarwal',
    personalEmail: 'neha.agarwal@greenfield.edu',
    mobileNumber: '+91 9100000001',
    employeeId: 'EMP-1001',
    specialization: 'Mathematics',
    experienceYears: '8',
    contractType: 'Full Time',
    leaveBalance: '10',
    salary: 42000,
    joiningDate: '2025-07-01',
    documentNames: ['Aadhar', 'Qualification Certificate'],
    photoUrl: '',
    assignedClass: 'B.Tech CSE / A',
  }),
  buildTeacher({
    id: 2002,
    firstName: 'Arjun',
    lastName: 'Mehta',
    personalEmail: 'arjun.mehta@greenfield.edu',
    mobileNumber: '+91 9100000002',
    employeeId: 'EMP-1002',
    specialization: 'Computer Science',
    experienceYears: '5',
    contractType: 'Full Time',
    leaveBalance: '7',
    salary: 39500,
    joiningDate: '2025-08-01',
    documentNames: ['Resume', 'Experience Certificate'],
    photoUrl: '',
    assignedClass: 'BCA Semester 1',
  }),
  buildTeacher({
    id: 2003,
    firstName: 'Pooja',
    lastName: 'Kapoor',
    personalEmail: 'pooja.kapoor@greenfield.edu',
    mobileNumber: '+91 9100000003',
    employeeId: 'EMP-1003',
    specialization: 'Commerce',
    experienceYears: '4',
    contractType: 'Part Time',
    leaveBalance: '5',
    salary: 26000,
    joiningDate: '2025-09-01',
    documentNames: ['Aadhar', 'Resume'],
    photoUrl: '',
    assignedClass: 'B.Com / A',
  }),
];

const greenfieldDrivers = [
  buildDriver({
    id: 3001,
    driverName: 'Ramesh Kumar',
    driverPhone: '+91 9200000001',
    driverLicense: 'DL-UP-2026-301',
    salary: 18000,
    busNumber: 'UP16 AB 1234',
    routeName: 'North Campus Route',
    vehicleType: 'School Bus',
    seatCapacity: '42',
    pickupPoints: 'Sector 10, Main Road, Station Circle, College Gate',
  }),
  buildDriver({
    id: 3002,
    driverName: 'Suresh Pal',
    driverPhone: '+91 9200000002',
    driverLicense: 'DL-UP-2026-302',
    salary: 16500,
    busNumber: 'UP16 CD 5678',
    routeName: 'City Center Route',
    vehicleType: 'Mini Bus',
    seatCapacity: '28',
    pickupPoints: 'Alpha 1, Beta 2, Pari Chowk, Campus Block B',
  }),
];

const greenfieldTransportStudents = [
  buildTransportStudent({
    id: 4001,
    studentId: '1001',
    studentName: 'Aarav Singh',
    className: 'BCA Semester 1',
    pickupStop: 'Sector 10',
    assignedDriverId: 3001,
    driverName: 'Ramesh Kumar',
    busNumber: 'UP16 AB 1234',
    routeName: 'North Campus Route',
  }),
  buildTransportStudent({
    id: 4002,
    studentId: '1002',
    studentName: 'Diya Sharma',
    className: 'BCA Semester 1',
    pickupStop: 'Station Circle',
    assignedDriverId: 3001,
    driverName: 'Ramesh Kumar',
    busNumber: 'UP16 AB 1234',
    routeName: 'North Campus Route',
  }),
  buildTransportStudent({
    id: 4003,
    studentId: '1004',
    studentName: 'Meera Joshi',
    className: 'B.Tech CSE / A',
    pickupStop: 'Pari Chowk',
    assignedDriverId: 3002,
    driverName: 'Suresh Pal',
    busNumber: 'UP16 CD 5678',
    routeName: 'City Center Route',
  }),
];

const greenfieldAttendance = [
  buildAttendanceRecord({
    id: 5001,
    date: '2026-04-26',
    lectureNumber: '1',
    subject: 'Programming Fundamentals',
    markedBy: 'Arjun Mehta',
    className: 'BCA Semester 1',
    studentId: 'EDU-1001',
    rollNo: '2026-BCA-001',
    studentName: 'Aarav Singh',
    status: 'Present',
  }),
  buildAttendanceRecord({
    id: 5002,
    date: '2026-04-26',
    lectureNumber: '1',
    subject: 'Programming Fundamentals',
    markedBy: 'Arjun Mehta',
    className: 'BCA Semester 1',
    studentId: 'EDU-1002',
    rollNo: '2026-BCA-002',
    studentName: 'Diya Sharma',
    status: 'Absent',
  }),
  buildAttendanceRecord({
    id: 5003,
    date: '2026-04-26',
    lectureNumber: '1',
    subject: 'Programming Fundamentals',
    markedBy: 'Arjun Mehta',
    className: 'BCA Semester 1',
    studentId: 'EDU-1003',
    rollNo: '2026-BCA-003',
    studentName: 'Kabir Verma',
    status: 'Present',
  }),
  buildAttendanceRecord({
    id: 5004,
    date: '2026-04-26',
    lectureNumber: '2',
    subject: 'Discrete Mathematics',
    markedBy: 'Neha Agarwal',
    className: 'B.Tech CSE / A',
    studentId: 'EDU-1004',
    rollNo: '2026-BTECH-014',
    studentName: 'Meera Joshi',
    status: 'Present',
  }),
  buildAttendanceRecord({
    id: 5005,
    date: '2026-04-26',
    lectureNumber: '2',
    subject: 'Discrete Mathematics',
    markedBy: 'Neha Agarwal',
    className: 'B.Tech CSE / A',
    studentId: 'EDU-1005',
    rollNo: '2026-BTECH-015',
    studentName: 'Rohan Iyer',
    status: 'Absent',
  }),
];

const greenfieldCourseBooks = [
  {
    id: 6001,
    className: 'BCA Semester 1',
    subjectName: 'Programming Fundamentals',
    bookTitle: 'Programming in C',
    author: 'E. Balagurusamy',
    publisher: 'McGraw Hill',
    edition: '8th Edition',
    isbn: '9780070702447',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Core programming textbook for first semester practical and theory.',
    createdAt: '2026-04-10T10:00:00.000Z',
  },
  {
    id: 6002,
    className: 'B.Tech CSE / A',
    subjectName: 'Discrete Mathematics',
    bookTitle: 'Discrete Mathematical Structures',
    author: 'J. P. Tremblay',
    publisher: 'McGraw Hill',
    edition: 'Revised Edition',
    isbn: '9780074631132',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Used for assignments and internal assessment support.',
    createdAt: '2026-04-10T10:10:00.000Z',
  },
  {
    id: 6003,
    className: 'B.Com / A',
    subjectName: 'Financial Accounting',
    bookTitle: 'Principles of Accounting',
    author: 'S. N. Maheshwari',
    publisher: 'Vikas Publishing',
    edition: '2026 Edition',
    isbn: '9789325981231',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Recommended along with departmental workbook.',
    createdAt: '2026-04-10T10:20:00.000Z',
  },
];

const greenfieldExamDateSheets = [
  {
    id: 6201,
    className: 'BCA Semester 1',
    examType: 'Mid Term Examination',
    fileName: 'bca-semester-1-mid-term-datesheet.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    createdAt: '2026-04-15T10:00:00.000Z',
  },
  {
    id: 6202,
    className: 'B.Tech CSE / A',
    examType: 'Mid Term Examination',
    fileName: 'btech-cse-a-mid-term-datesheet.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    createdAt: '2026-04-15T10:10:00.000Z',
  },
];

const greenfieldQuestionPapers = [
  {
    id: 6301,
    examTitle: 'Mid Term Examination',
    className: 'BCA Semester 1',
    subjectName: 'Programming Fundamentals',
    uploadedBy: 'Arjun Mehta',
    fileName: 'programming-fundamentals-question-paper.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    createdAt: '2026-04-16T09:00:00.000Z',
  },
];

const greenfieldAdmitCards = [
  {
    id: 6401,
    examTitle: 'Mid Term Examination',
    studentId: 'EDU-1001',
    studentName: 'Aarav Singh',
    rollNo: '2026-BCA-001',
    className: 'BCA Semester 1',
    centerName: 'Main Examination Hall',
    reportingTime: '09:15',
    examDate: '2026-05-12',
    createdAt: '2026-04-17T10:00:00.000Z',
  },
];

const greenfieldFeeStructures = [
  {
    id: 6801,
    courseId: 'BCA Semester 1',
    category: 'General',
    feeComponent: 'Tuition',
    cycleMonths: 3,
    amount: 28000,
    dueDate: '2026-04-20',
    createdAt: '2026-04-01T09:00:00.000Z',
  },
  {
    id: 6802,
    courseId: 'BCA Semester 1',
    category: 'General',
    feeComponent: 'Transport',
    cycleMonths: 3,
    billingType: 'monthly_active',
    amount: 3200,
    dueDate: '2026-04-20',
    createdAt: '2026-04-01T09:05:00.000Z',
  },
  {
    id: 6803,
    courseId: 'B.Tech CSE / A',
    category: 'General',
    feeComponent: 'Hostel',
    cycleMonths: 3,
    billingType: 'monthly_active',
    amount: 6500,
    dueDate: '2026-04-25',
    createdAt: '2026-04-01T09:08:00.000Z',
  },
  {
    id: 6804,
    courseId: 'B.Tech CSE / A',
    category: 'General',
    feeComponent: 'Lab',
    cycleMonths: 1,
    amount: 12000,
    dueDate: '2026-04-25',
    createdAt: '2026-04-01T09:10:00.000Z',
  },
  {
    id: 6805,
    courseId: 'B.Com / A',
    category: 'Scholarship',
    feeComponent: 'Library',
    cycleMonths: 1,
    amount: 3500,
    dueDate: '2026-05-10',
    createdAt: '2026-04-01T09:20:00.000Z',
  },
];

const greenfieldFeePayments = [
  {
    id: 6901,
    structureId: 6801,
    studentId: 1001,
    transactionId: 'TXN-GF-1001',
    gatewayRef: 'upi_gf_001',
    mode: 'UPI',
    paymentStatus: 'Success',
    paidAmount: 28000,
    paymentDate: '2026-04-18',
    receiptNumber: 'FEE-2026-1001',
    taxBreakdown: 'Base Rs 22960 + GST Rs 5040',
    balanceRemaining: 0,
    downloadLink: 'receipt-FEE-2026-1001.txt',
    createdAt: '2026-04-18T11:00:00.000Z',
  },
  {
    id: 6902,
    structureId: 6802,
    studentId: 1001,
    transactionId: 'TXN-GF-1001-TR',
    gatewayRef: 'upi_gf_tr_001',
    mode: 'UPI',
    paymentStatus: 'Success',
    paidAmount: 6400,
    paymentDate: '2026-05-02',
    receiptNumber: 'FEE-2026-1001-TR',
    taxBreakdown: 'Base Rs 5248 + GST Rs 1152',
    balanceRemaining: 0,
    coveredMonths: ['2026-04', '2026-05'],
    resolvedMonths: ['2026-04', '2026-05'],
    coverageLabel: 'Apr 2026 - Jun 2026',
    billedMonthsCount: 2,
    billingType: 'monthly_active',
    downloadLink: 'receipt-FEE-2026-1001-TR.txt',
    createdAt: '2026-05-02T10:00:00.000Z',
  },
  {
    id: 6903,
    structureId: 6804,
    studentId: 1004,
    transactionId: 'TXN-GF-1004',
    gatewayRef: 'card_gf_014',
    mode: 'Card',
    paymentStatus: 'Success',
    paidAmount: 8000,
    paymentDate: '2026-04-26',
    receiptNumber: 'FEE-2026-1004',
    taxBreakdown: 'Base Rs 6560 + GST Rs 1440',
    balanceRemaining: 4000,
    downloadLink: 'receipt-FEE-2026-1004.txt',
    createdAt: '2026-04-26T12:00:00.000Z',
  },
];

const greenfieldClassTimetable = [
  {
    id: 7201,
    className: 'BCA Semester 1',
    fileName: 'bca-semester-1-weekly-timetable.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    uploadedAt: '2026-04-20T09:00:00.000Z',
    createdAt: '2026-04-20T09:00:00.000Z',
  },
  {
    id: 7202,
    className: 'B.Tech CSE / A',
    fileName: 'btech-cse-a-weekly-timetable.xlsx',
    fileData: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQ...',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-04-20T09:10:00.000Z',
    createdAt: '2026-04-20T09:10:00.000Z',
  },
  {
    id: 7203,
    className: 'B.Com / A',
    fileName: 'bcom-a-weekly-timetable.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    uploadedAt: '2026-04-20T09:20:00.000Z',
    createdAt: '2026-04-20T09:20:00.000Z',
  },
];

const greenfieldExamTimetable = [
  {
    id: 7301,
    examTitle: 'Mid Term Examination',
    className: 'BCA Semester 1',
    subjectName: 'Programming Fundamentals',
    examDate: '2026-05-12',
    dayOfWeek: 'Tuesday',
    timeFrom: '09:30',
    timeTo: '12:30',
    roomId: 'Main Examination Hall',
    invigilatorName: 'Neha Agarwal',
    examDuration: '3 Hours',
    studentSeatingRange: 'Roll 2026-BCA-001 to 2026-BCA-060',
    createdAt: '2026-04-21T10:00:00.000Z',
  },
  {
    id: 7302,
    examTitle: 'Mid Term Examination',
    className: 'B.Tech CSE / A',
    subjectName: 'Discrete Mathematics',
    examDate: '2026-05-14',
    dayOfWeek: 'Thursday',
    timeFrom: '09:30',
    timeTo: '12:30',
    roomId: 'Seminar Hall B',
    invigilatorName: 'Arjun Mehta',
    examDuration: '3 Hours',
    studentSeatingRange: 'Roll 2026-BTECH-001 to 2026-BTECH-080',
    createdAt: '2026-04-21T10:10:00.000Z',
  },
];

const sunriseStudents = createSchoolStudents();
const sunriseTeachers = createSchoolTeachers();
const sunriseDrivers = createSchoolDrivers();
const sunriseTransportStudents = createSchoolTransportStudents(sunriseStudents, sunriseDrivers);
const sunriseAttendance = createSchoolAttendance(sunriseStudents, sunriseTeachers);
const sunriseCourseBooks = [
  {
    id: 6101,
    className: 'LKG / A',
    subjectName: 'Early Learning',
    bookTitle: 'My First Picture Book',
    author: 'Sunrise Academic Panel',
    publisher: 'Sunrise School Press',
    edition: '2026 Edition',
    isbn: 'SUN-LKG-001',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Foundation literacy and visuals for nursery transition.',
    createdAt: '2026-04-12T09:00:00.000Z',
  },
  {
    id: 6102,
    className: 'Class 5 / B',
    subjectName: 'Mathematics',
    bookTitle: 'NCERT Mathematics Class 5',
    author: 'NCERT',
    publisher: 'NCERT',
    edition: '2026 Edition',
    isbn: 'NCERT-5-MATH',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Main classroom text for arithmetic and word problems.',
    createdAt: '2026-04-12T09:10:00.000Z',
  },
  {
    id: 6103,
    className: 'Class 8 / C',
    subjectName: 'Science',
    bookTitle: 'Science Explorer Class 8',
    author: 'R. K. Gupta',
    publisher: 'Evergreen Publications',
    edition: '5th Edition',
    isbn: 'EVG-8-SCI',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Laboratory-linked theory book with activity references.',
    createdAt: '2026-04-12T09:20:00.000Z',
  },
  {
    id: 6104,
    className: 'Class 10 / A',
    subjectName: 'English',
    bookTitle: 'First Flight',
    author: 'NCERT',
    publisher: 'NCERT',
    edition: '2026 Edition',
    isbn: 'NCERT-10-ENG',
    language: 'English',
    academicYear: '2026-27',
    notes: 'CBSE core text for literature and comprehension.',
    createdAt: '2026-04-12T09:30:00.000Z',
  },
  {
    id: 6105,
    className: 'Class 12 / Science',
    subjectName: 'Physics',
    bookTitle: 'Concepts of Physics Volume 2',
    author: 'H. C. Verma',
    publisher: 'Bharati Bhawan',
    edition: 'Latest Edition',
    isbn: '9788177091877',
    language: 'English',
    academicYear: '2026-27',
    notes: 'Reference plus problem-solving support for board preparation.',
    createdAt: '2026-04-12T09:40:00.000Z',
  },
];

const sunriseExamDateSheets = [
  {
    id: 6501,
    className: 'Class 8 / A',
    examType: 'Unit Test 1',
    fileName: 'class-8-a-unit-test-1-datesheet.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    createdAt: '2026-04-18T09:00:00.000Z',
  },
];

const sunriseQuestionPapers = [
  {
    id: 6601,
    examTitle: 'Unit Test 1',
    className: 'Class 8 / A',
    subjectName: 'English',
    uploadedBy: 'Sonal Bhardwaj',
    fileName: 'class-8-english-unit-test.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    createdAt: '2026-04-18T09:30:00.000Z',
  },
];

const sunriseAdmitCards = [
  {
    id: 6701,
    examTitle: 'Unit Test 1',
    studentId: 'EDU-1101',
    studentName: 'Bhavya Gupta',
    rollNo: 'LKG-A-001',
    className: 'LKG / A',
    centerName: 'Junior Wing Hall',
    reportingTime: '08:00',
    examDate: '2026-05-08',
    createdAt: '2026-04-18T10:00:00.000Z',
  },
];

const sunriseFeeStructures = [
  {
    id: 7001,
    courseId: 'LKG / A',
    category: 'General',
    feeComponent: 'Tuition',
    cycleMonths: 3,
    amount: 18000,
    dueDate: '2026-04-15',
    createdAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 7002,
    courseId: 'LKG / A',
    category: 'General',
    feeComponent: 'Transport',
    cycleMonths: 3,
    billingType: 'monthly_active',
    amount: 2200,
    dueDate: '2026-04-15',
    createdAt: '2026-04-02T09:05:00.000Z',
  },
  {
    id: 7003,
    courseId: 'Class 8 / C',
    category: 'General',
    feeComponent: 'Lab',
    cycleMonths: 1,
    amount: 6000,
    dueDate: '2026-04-22',
    createdAt: '2026-04-02T09:10:00.000Z',
  },
  {
    id: 7004,
    courseId: 'Class 12 / Science',
    category: 'General',
    feeComponent: 'Library',
    cycleMonths: 1,
    amount: 4500,
    dueDate: '2026-05-05',
    createdAt: '2026-04-02T09:20:00.000Z',
  },
];

const sunriseFeePayments = [
  {
    id: 7101,
    structureId: 7001,
    studentId: 1101,
    transactionId: 'TXN-SR-1101',
    gatewayRef: 'upi_sr_001',
    mode: 'UPI',
    paymentStatus: 'Success',
    paidAmount: 18000,
    paymentDate: '2026-04-12',
    receiptNumber: 'FEE-2026-1101',
    taxBreakdown: 'Base Rs 14760 + GST Rs 3240',
    balanceRemaining: 0,
    downloadLink: 'receipt-FEE-2026-1101.txt',
    createdAt: '2026-04-12T10:00:00.000Z',
  },
  {
    id: 7102,
    structureId: 7002,
    studentId: 1101,
    transactionId: 'TXN-SR-1101-TR',
    gatewayRef: 'upi_sr_tr_001',
    mode: 'UPI',
    paymentStatus: 'Success',
    paidAmount: 2200,
    paymentDate: '2026-04-18',
    receiptNumber: 'FEE-2026-1101-TR',
    taxBreakdown: 'Base Rs 1804 + GST Rs 396',
    balanceRemaining: 0,
    coveredMonths: ['2026-04'],
    resolvedMonths: ['2026-04'],
    coverageLabel: 'Apr 2026 - Jun 2026',
    billedMonthsCount: 1,
    billingType: 'monthly_active',
    downloadLink: 'receipt-FEE-2026-1101-TR.txt',
    createdAt: '2026-04-18T10:20:00.000Z',
  },
  {
    id: 7103,
    structureId: 7003,
    studentId: 1551,
    transactionId: 'TXN-SR-1341',
    gatewayRef: 'cash_sr_021',
    mode: 'Cash',
    paymentStatus: 'Success',
    paidAmount: 3000,
    paymentDate: '2026-04-23',
    receiptNumber: 'FEE-2026-1341',
    taxBreakdown: 'Base Rs 2460 + GST Rs 540',
    balanceRemaining: 3000,
    downloadLink: 'receipt-FEE-2026-1341.txt',
    createdAt: '2026-04-23T10:30:00.000Z',
  },
];

const sunriseClassTimetable = [
  {
    id: 7401,
    className: 'LKG / A',
    fileName: 'lkg-a-weekly-timetable.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    uploadedAt: '2026-04-22T08:30:00.000Z',
    createdAt: '2026-04-22T08:30:00.000Z',
  },
  {
    id: 7402,
    className: 'Class 5 / B',
    fileName: 'class-5-b-weekly-timetable.xlsx',
    fileData: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQ...',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-04-22T08:40:00.000Z',
    createdAt: '2026-04-22T08:40:00.000Z',
  },
  {
    id: 7403,
    className: 'Class 8 / C',
    fileName: 'class-8-c-weekly-timetable.pdf',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcfs...',
    fileType: 'application/pdf',
    uploadedAt: '2026-04-22T08:50:00.000Z',
    createdAt: '2026-04-22T08:50:00.000Z',
  },
];

const sunriseExamTimetable = [
  {
    id: 7501,
    examTitle: 'Unit Test 1',
    className: 'Class 8 / A',
    subjectName: 'English',
    examDate: '2026-05-08',
    dayOfWeek: 'Friday',
    timeFrom: '08:30',
    timeTo: '10:00',
    roomId: 'Exam Hall 1',
    invigilatorName: 'Sonal Bhardwaj',
    examDuration: '1 Hour 30 Minutes',
    studentSeatingRange: 'Roll CLASS8-A-001 to CLASS8-A-040',
    createdAt: '2026-04-22T09:30:00.000Z',
  },
  {
    id: 7502,
    examTitle: 'Unit Test 1',
    className: 'Class 12 / Science',
    subjectName: 'Physics',
    examDate: '2026-05-10',
    dayOfWeek: 'Sunday',
    timeFrom: '09:00',
    timeTo: '11:00',
    roomId: 'Senior Lab Hall',
    invigilatorName: 'Pankaj Tandon',
    examDuration: '2 Hours',
    studentSeatingRange: 'Roll CLASS12-SCI-001 to CLASS12-SCI-045',
    createdAt: '2026-04-22T09:40:00.000Z',
  },
];

const demoDatasets = {
  greenfield_demo: {
    students: greenfieldStudents,
    teachers: greenfieldTeachers,
    transport_drivers: greenfieldDrivers,
    transport_students: greenfieldTransportStudents,
    attendance_records: greenfieldAttendance,
    course_books: greenfieldCourseBooks,
    exam_datesheets: greenfieldExamDateSheets,
    exam_question_papers: greenfieldQuestionPapers,
    exam_admit_cards: greenfieldAdmitCards,
    fee_structures: greenfieldFeeStructures,
    fee_payments: greenfieldFeePayments,
    timetable_class_slots: greenfieldClassTimetable,
    timetable_exam_slots: greenfieldExamTimetable,
  },
  sunrise_demo: {
    students: sunriseStudents,
    teachers: sunriseTeachers,
    transport_drivers: sunriseDrivers,
    transport_students: sunriseTransportStudents,
    attendance_records: sunriseAttendance,
    course_books: sunriseCourseBooks,
    exam_datesheets: sunriseExamDateSheets,
    exam_question_papers: sunriseQuestionPapers,
    exam_admit_cards: sunriseAdmitCards,
    fee_structures: sunriseFeeStructures,
    fee_payments: sunriseFeePayments,
    timetable_class_slots: sunriseClassTimetable,
    timetable_exam_slots: sunriseExamTimetable,
  },
};

export const seedDemoData = () => {
  localStorage.setItem('registered_colleges', JSON.stringify(demoInstitutions));

  Object.entries(demoDatasets).forEach(([tenantId, modules]) => {
    Object.entries(modules).forEach(([moduleName, records]) => {
      localStorage.setItem(`${tenantId}_${moduleName}`, JSON.stringify(records));
    });
  });
};

export const activateDemoSession = (username = 'greenfield_demo') => {
  const institution = demoInstitutions.find((college) => college.username === username);
  if (!institution) return null;

  localStorage.setItem('active_session', JSON.stringify({
    username: institution.username,
    instituteName: institution.instituteName,
    type: institution.type,
    role: 'admin',
    logo: institution.logo,
  }));
  localStorage.setItem('current_college_id', institution.id);
  return institution;
};

export const demoCredentials = demoInstitutions.map((institution) => ({
  instituteName: institution.instituteName,
  username: institution.username,
  password: institution.password,
  type: institution.type,
}));
