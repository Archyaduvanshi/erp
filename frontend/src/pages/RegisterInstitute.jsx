import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { instituteApi, setAccessToken, uploadApi } from '../utils/api';
import { platformApi } from '../api/platformApi';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, Building2, Mail, Lock, ArrowRight, 
  CheckCircle2, Phone, MapPin, Hash, Globe, 
  Upload, School, Landmark, ShieldCheck, Eye, EyeOff
} from 'lucide-react';

const UPPERCASE_FIELDS = [
  'instituteName',
  'affiliationNo',
  'affiliatedFrom',
  'address',
  'state',
  'city',
];

const DIGIT_FIELDS = {
  contact: 10,
  pincode: 6,
};

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters with 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol.';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const RegisterInstitute = ({ platformManaged = false }) => {
  const navigate = useNavigate();
  const { acceptLogin } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredSession, setRegisteredSession] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [visiblePasswordField, setVisiblePasswordField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    instituteName: '',
    type: 'College',
    affiliationNo: '',
    affiliatedFrom: '',
    contact: '',
    email: '',
    website: '',
    address: '',
    state: '',
    city: '',
    pincode: '',
    password: '',
    confirmPassword: ''
  });

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoFile(null);
      setLogoPreview(null);
      setFieldErrors((currentErrors) => ({ ...currentErrors, logo: 'Institution logo must be 2 MB or smaller.' }));
      setError('Please fix the highlighted fields.');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
    setFieldErrors((currentErrors) => ({ ...currentErrors, logo: '' }));
  };

  const updateField = (field, value) => {
    let nextValue = value;

    if (UPPERCASE_FIELDS.includes(field)) {
      nextValue = value.toUpperCase();
    }
    if (field === 'email') {
      nextValue = value.trim().toLowerCase();
    }

    if (DIGIT_FIELDS[field]) {
      nextValue = value.replace(/\D/g, '').slice(0, DIGIT_FIELDS[field]);
    }

    setFormData((currentData) => ({
      ...currentData,
      [field]: nextValue,
    }));
    setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: '' }));
    setError('');
  };

  const validateForm = () => {
    const errors = {};

    Object.entries(formData).forEach(([field, value]) => {
      if (field === 'website') return;
      if (!String(value).trim()) {
        errors[field] = 'This field is required.';
      }
    });

    if (!logoFile && !logoPreview) {
      errors.logo = 'Institution logo is required.';
    }

    if (formData.contact && !/^\d{10}$/.test(formData.contact)) {
      errors.contact = 'Contact number must be exactly 10 digits.';
    }

    if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
      errors.pincode = 'Pincode must be exactly 6 digits.';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Official email must be valid.';
    }

    if (formData.password && !PASSWORD_PATTERN.test(formData.password)) {
      errors.password = PASSWORD_MESSAGE;
    }

    if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Password and confirm password do not match.';
    }

    return errors;
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswordField((currentField) => currentField === field ? null : field);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedLogo = logoFile
        ? await uploadApi.uploadRegistrationLogo(logoFile)
        : null;
      const payload = {
        ...formData,
        email: formData.email.trim().toLowerCase(),
        logo: uploadedLogo?.url || logoPreview,
      };
      const registeredInstitute = platformManaged
        ? await platformApi.createInstitute(payload)
        : await instituteApi.register(payload);

      const session = {
        ...registeredInstitute,
        authenticated: true,
      };
      if (!platformManaged) {
        setAccessToken(registeredInstitute.accessToken || '');
        acceptLogin(session);
      }
      setRegisteredSession(session);

      setIsSuccess(true);
    } catch (apiError) {
      setError(apiError.message);
      setFieldErrors(apiError.fieldErrors || {});
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    const institutionCode = registeredSession?.institutionCode || registeredSession?.username || '';
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 size={40} />
          </div>
          {/* Resolved the CSS conflict here by keeping only text-transparent for gradient */}
          <h1 className="text-3xl font-black mb-4 tracking-tighter uppercase italic text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-500">
            Institution Registered!
          </h1>
          <p className="text-slate-500 font-medium">Preparing your secure SaaS environment...</p>
          {institutionCode && (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Your Institution Code</p>
              <p className="mt-2 text-3xl font-black uppercase tracking-widest text-slate-950">{institutionCode}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(institutionCode)}
                className="mt-4 rounded-2xl bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm transition hover:text-blue-800"
              >
                Copy Code
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate(platformManaged ? '/platform/institutes' : '/college')}
            className="mt-8 inline-flex items-center justify-center gap-3 rounded-3xl bg-slate-950 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-100 transition hover:-translate-y-1 hover:bg-blue-600"
          >
            {platformManaged ? 'Return to Institutes' : 'Continue to Dashboard'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFF] flex flex-col lg:flex-row font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      
      {/* --- LEFT: SAAS BRANDING SIDEBAR --- */}
      <div className="lg:w-1/3 bg-slate-950 p-12 lg:p-20 text-white flex flex-col justify-between relative overflow-hidden lg:sticky lg:top-0 lg:h-screen text-left">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,var(--color-blue-900)_0%,transparent_60%)] opacity-40" />
        
        <Link to={platformManaged ? '/platform/dashboard' : '/'} className="flex items-center gap-3 relative z-10 group">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform">
            <GraduationCap className="text-white" size={26} />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase italic">VidyantraErp</span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-black mb-8 leading-tight tracking-tighter">
            Unlock the power of <br/> 
            <span className="text-blue-500">Smart Management.</span>
          </h2>
          <ul className="space-y-4">
            <FeatureItem text="Integrated Admission Workflows" /> {/* [cite: 8-12] */}
            <FeatureItem text="Automated Fee Receipt Generation" /> {/* [cite: 19-24] */}
            <FeatureItem text="Comprehensive Sports Records" /> {/* [cite: 89-108] */}
            <FeatureItem text="Infrastructure & Expense Tracking" /> {/* [cite: 64-69] */}
          </ul>
        </div>

        <p className="text-slate-500 mt-3 text-[10px] font-black uppercase tracking-[0.3em] relative z-10">
          © 2026 VidyantraErp SaaS Platform
        </p>
      </div>

      {/* --- RIGHT: THE ONBOARDING FORM --- */}
      <div className="lg:flex-1 p-8 lg:p-20 flex flex-col items-center">
        <div className="w-full max-w-3xl bg-white shadow-2xl shadow-slate-200/50 rounded-[2.5rem] border border-slate-100 p-8 md:p-12">
          <div className="mb-12 text-left">
            <h1 className="text-3xl font-black text-slate-950 mb-2 tracking-tighter uppercase italic">Onboard Your Institute</h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">All fields are required for multi-tenant setup</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10" noValidate>
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-left text-sm font-semibold text-rose-600">
                {error}
              </div>
            )}
            
            {/* SECTION 1: IDENTITY */}
            <div className="space-y-6">
              <h3 className="text-blue-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-left">
                <Landmark size={14}/> 01. Institutional Identity
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <InputGroup 
                  label="Institution Name" icon={Building2} placeholder="e.g. Stanford University" 
                  value={formData.instituteName} onChange={(e) => updateField('instituteName', e.target.value)} error={fieldErrors.instituteName} required
                />
                <div className="space-y-2 text-left">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Institution Type</label>
                  <select 
                    className="w-full bg-white border-2 border-slate-300 rounded-2xl px-5 py-4 font-bold text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all appearance-none"
                    value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="College">College / University</option>
                    <option value="School">School / Secondary</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <InputGroup label="Affiliation No." icon={Hash} placeholder="REG-12345" value={formData.affiliationNo} onChange={(e) => updateField('affiliationNo', e.target.value)} error={fieldErrors.affiliationNo} required />
                <InputGroup label={formData.type === 'School' ? 'Board' : 'University'} icon={School} placeholder="e.g. CBSE / AKTU" value={formData.affiliatedFrom} onChange={(e) => updateField('affiliatedFrom', e.target.value)} error={fieldErrors.affiliatedFrom} required />
              </div>

              {/* Logo Upload */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Institution Logo</label>
                <div className="flex items-center gap-6 p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 relative group transition-colors hover:border-blue-400">
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" required />
                  <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? <img src={logoPreview} className="w-full h-full object-cover" alt="logo" /> : <Upload className="text-slate-300" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Click to upload logo</p>
                    <p className="text-[10px] text-slate-400">PNG, JPG up to 2MB</p>
                  </div>
                </div>
                {fieldErrors.logo && <p className="text-xs font-bold text-rose-600">{fieldErrors.logo}</p>}
              </div>
            </div>

            {/* SECTION 2: CONTACT */}
            <div className="space-y-6">
              <h3 className="text-blue-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-left">
                <Globe size={14}/> 02. Digital & Contact Details
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <InputGroup label="Contact Number" icon={Phone} inputMode="numeric" placeholder="9876543210" value={formData.contact} onChange={(e) => updateField('contact', e.target.value)} error={fieldErrors.contact} required />
                <InputGroup label="Official Email" icon={Mail} type="email" placeholder="admin@domain.edu" value={formData.email} onChange={(e) => updateField('email', e.target.value)} error={fieldErrors.email} required />
              </div>
              {/* Added Website URL field here */}
              <InputGroup label="Website URL (Optional)" icon={Globe} placeholder="https://www.yourinstitute.com" value={formData.website} onChange={(e) => updateField('website', e.target.value)} error={fieldErrors.website} />
            </div>

            {/* SECTION 3: LOCATION */}
            <div className="space-y-6">
              <h3 className="text-blue-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-left">
                <MapPin size={14}/> 03. Physical Address
              </h3>
              <div className="space-y-2 text-left">
                 <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Street, Building, Landmark</label>
                 <textarea 
                    className="w-full bg-white border-2 border-slate-300 rounded-2xl px-5 py-4 font-bold text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all min-h-25"
                    placeholder="Enter full physical address..."
                    value={formData.address} onChange={(e) => updateField('address', e.target.value)}
                    required
                 />
                 {fieldErrors.address && <p className="text-xs font-bold text-rose-600">{fieldErrors.address}</p>}
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <InputGroup label="State" icon={MapPin} placeholder="e.g. Uttar Pradesh" value={formData.state} onChange={(e) => updateField('state', e.target.value)} error={fieldErrors.state} required />
                <InputGroup label="City" icon={Building2} placeholder="e.g. Noida" value={formData.city} onChange={(e) => updateField('city', e.target.value)} error={fieldErrors.city} required />
                <InputGroup label="Pincode" icon={Hash} inputMode="numeric" placeholder="201301" value={formData.pincode} onChange={(e) => updateField('pincode', e.target.value)} error={fieldErrors.pincode} required />
              </div>
            </div>

            {/* SECTION 4: SECURITY */}
            <div className="space-y-6">
              <h3 className="text-blue-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-left">
                <Lock size={14}/> 04. Access Security
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <InputGroup
                  label="Password"
                  icon={Lock}
                  type={visiblePasswordField === 'password' ? 'text' : 'password'}
                  placeholder="Password@123"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  error={fieldErrors.password}
                  endAction={
                    <PasswordToggle isVisible={visiblePasswordField === 'password'} onClick={() => togglePasswordVisibility('password')} />
                  }
                  required
                />
                <InputGroup
                  label="Confirm Password"
                  icon={ShieldCheck}
                  type={visiblePasswordField === 'confirmPassword' ? 'text' : 'password'}
                  placeholder="Password@123"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  error={fieldErrors.confirmPassword}
                  endAction={
                    <PasswordToggle isVisible={visiblePasswordField === 'confirmPassword'} onClick={() => togglePasswordVisibility('confirmPassword')} />
                  }
                  required
                />
              </div>
            </div>

            <button disabled={isSubmitting} className="w-full bg-slate-950 text-white py-6 rounded-4xl font-black uppercase tracking-widest text-sm hover:bg-blue-600 hover:-translate-y-1 transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3 group disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0">
              {isSubmitting ? 'Registering Institution...' : 'Register & Setup Institution'}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- HELPERS (FIXED: PASSING ICON AS COMPONENT) ---
const FeatureItem = ({ text }) => (
  <li className="flex items-center gap-4 text-sm font-bold text-slate-300">
    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
      <CheckCircle2 size={14} className="text-white" />
    </div>
    {text}
  </li>
);

const PasswordToggle = ({ isVisible, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-blue-600 focus:outline-none"
    aria-label={isVisible ? 'Hide password' : 'Show password'}
    title={isVisible ? 'Hide password' : 'Show password'}
  >
    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
);

const InputGroup = ({ label, icon: Icon, type = "text", error, helper, endAction, ...props }) => (
  <div className="space-y-2 text-left">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <div className="relative group">
      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
        <Icon size={18} />
      </div>
      <input 
        type={type}
        className={`w-full bg-white border-2 rounded-2xl pl-12 ${endAction ? 'pr-12' : 'pr-5'} py-4 font-bold text-sm text-slate-900 shadow-sm outline-none focus:ring-4 transition-all placeholder:text-slate-400 ${error ? 'border-rose-400 focus:ring-rose-100 focus:border-rose-500' : 'border-slate-300 focus:ring-blue-100 focus:border-blue-600'}`}
        {...props}
      />
      {endAction}
    </div>
    {helper && <p className="text-[10px] font-bold leading-5 text-slate-400">{helper}</p>}
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
  </div>
);

export default RegisterInstitute;

