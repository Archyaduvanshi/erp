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

export const getFacilityKeyFromFeeComponent = (feeComponent = '') => {
  const component = String(feeComponent).toLowerCase();
  if (component.includes('transport')) return 'transport';
  if (component.includes('hostel')) return 'hostel';
  if (component.includes('library')) return 'library';
  return '';
};

export const getFeeFacilityKey = (structure = {}) => (
  structure.facilityKey || getFacilityKeyFromFeeComponent(structure.feeComponent)
);

export const isFeeStructureApplicableToStudent = (structure, student) => {
  const facilityKey = getFeeFacilityKey(structure);
  const isFacilityFee = structure?.feeType === 'facility_fee' || structure?.billingType === 'monthly_active' || Boolean(facilityKey);
  if (!isFacilityFee) return true;
  return facilityKey ? isFacilityActive(student, facilityKey) : true;
};
