export const isFacilityRequested = (student, facilityKey) => (
  student?.[`${facilityKey}OptIn`] === 'yes' || student?.[`${facilityKey}OptIn`] === true
);

export const isFacilityActive = (student, facilityKey) => (
  isFacilityRequested(student, facilityKey) && (student?.[`${facilityKey}Status`] || 'inactive') === 'active'
);

export const getFacilityAccessState = (student, facilityKey) => ({
  requested: isFacilityRequested(student, facilityKey),
  active: isFacilityActive(student, facilityKey),
  status: student?.[`${facilityKey}Status`] || 'inactive',
});
