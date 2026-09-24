import LearningOperations from './LearningOperations';
import ContractManagement from './ContractManagement';
import {useEffect, useState} from 'react';
import {Check, DollarSign, Eye, EyeOff, LogOut, Menu, Plus, Search, ShieldCheck, Trash2, UserRound, X} from 'lucide-react';
import {signOut, User} from 'firebase/auth';
import {auth} from './firebase';
import divisions from './data/vietnam-divisions.json';
import JobManagement from './JobManagement';
import {createUser, createStaff, deleteStaff, getRevenue, listStaff, listUsers, ManagedUser, StaffAdmin, Tutor, updateStaff, updateTutorStatus, updateUserProfile, updateUserStatus} from './api';

type Props = {user: User; role: 'admin' | 'super_admin'};
type Profile = ManagedUser | StaffAdmin;
type AddressState = {province: string; district: string; ward: string; detail: string};
const SUBJECT_OPTIONS = ['Toán', 'Văn', 'Anh văn', 'Lý', 'Hóa', 'Sinh', 'Sử', 'Địa'];
const GRADE_OPTIONS = Array.from({length: 12}, (_, index) => `Lớp ${index + 1}`);
const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa cập nhật';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
};

const getAccountLabel = (item: Profile) => {
  if (item.disabled || item.accountStatus === 'locked') return 'locked';
  if (item.tutorStatus) {
    const status = ({APPROVED: 'active', PENDING: 'pending', REJECTED: 'rejected', DRAFT: 'draft', SUSPENDED: 'locked'} as Record<string, string>)[item.tutorStatus];
    if (status) return status;
  }
  if (item.tutorStatus === 'DRAFT') return 'draft';
  if (item.role === 'tutor' || item.approvalStatus) {
    if (item.approvalStatus === 'rejected') return 'rejected';
    if (item.approvalStatus !== 'approved') return 'pending';
  }
  return item.accountStatus || 'active';
};
const getApprovalLabel = (status?: 'pending' | 'approved' | 'rejected') => status === 'approved' ? 'active' : status || 'pending';
const getStatusText = (status?: string) => ({draft: 'Bản nháp', approved: 'Hoạt động', active: 'Hoạt động', pending: 'Chờ duyệt', rejected: 'Bị từ chối', locked: 'Đã khóa'}[status || 'active'] || status);
const imageSource = (value?: string | null) => {
  if (!value) return '';
  if (/^(data:image\/(png|jpe?g|gif|webp);base64,|https?:\/\/)/i.test(value)) return value;
  if (/^[A-Za-z0-9+/=\s]+$/.test(value)) return `data:image/${value.startsWith('iVBOR') ? 'png' : value.startsWith('R0lG') ? 'gif' : value.startsWith('UklGR') ? 'webp' : 'jpeg'};base64,${value.replace(/\s/g, '')}`;
  return '';
};
const ProfileImages = ({profile}: {profile: Profile}) => <div className="document-grid">{
  ([['Ảnh đại diện', profile.photoURL || profile.avatarBase64 || profile.avatarUrl], ['Giấy tờ', profile.documentBase64], ['Bằng cấp', profile.degreeImageBase64 || profile.degreeUrl], ['Chứng chỉ', profile.certificateImageBase64 || profile.certificateUrl]] as const)
    .map(([label, value]) => imageSource(value) ? <div key={label}><span className="detail-label">{label}</span><a href={imageSource(value)} target="_blank" rel="noreferrer"><img src={imageSource(value)} alt={label} /></a></div> : null)
}</div>;

const toAddressText = (value?: AddressState | string | null) => {
  if (!value) return 'Chưa cập nhật';
  if (typeof value === 'string') return value || 'Chưa cập nhật';
  const parts = [value.detail, value.ward, value.district, value.province].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Chưa cập nhật';
};

const parseAddress = (value?: AddressState | string | null): AddressState => {
  if (value && typeof value === 'object') return {...value};
  const parts = (value || '').split(',').map(item => item.trim()).filter(Boolean);
  const province = divisions.find(item => item.name === parts.at(-1));
  if (province && province.wards.some(item => item.name === parts.at(-2))) {
    return {province: parts.pop()!, ward: parts.pop()!, district: '', detail: parts.join(', ')};
  }
  return {province: '', district: '', ward: '', detail: value || ''};
};
const AddressSelector = ({value, onChange}: {value: AddressState; onChange: (next: AddressState) => void}) => {
  const wards = divisions.find(item => item.name === value.province)?.wards || [];
  return <div className="address-grid">
    <label className="field"><span>Tỉnh / Thành phố</span><select value={value.province} onChange={event => onChange({...value, province: event.target.value, district: '', ward: ''})}><option value="">-- Chọn tỉnh/thành phố --</option>{divisions.map(item => <option key={item.code}>{item.name}</option>)}</select></label>
    <label className="field"><span>Xã / Phường / Đặc khu</span><select required={!!value.province} value={value.ward} onChange={event => onChange({...value, ward: event.target.value})} disabled={!value.province}><option value="">-- Chọn xã/phường --</option>{wards.map(item => <option key={item.code}>{item.name}</option>)}</select></label>
    <label className="field field-full"><span>Địa chỉ chi tiết</span><input value={value.detail} onChange={event => onChange({...value, detail: event.target.value})} placeholder="Số nhà, tên đường, thôn/xóm" /></label>
  </div>;
};

const DetailModal = ({profile, onClose, onEdit}: {profile: Profile; onClose: () => void; onEdit: () => void}) => (
  <div className="modal-backdrop" onClick={onClose}><section className="profile-modal" onClick={event => event.stopPropagation()}>
    <div className="modal-header"><div><p className="eyebrow">THÔNG TIN TÀI KHOẢN</p><h2>{profile.displayName}</h2></div><button className="icon-button modal-close" onClick={onClose}><X size={20} /></button></div>
    <div className="profile-grid"><div><span className="detail-label">Email</span><strong>{profile.email}</strong></div><div><span className="detail-label">Số điện thoại</span><strong>{profile.phoneNumber || 'Chưa cập nhật'}</strong></div><div><span className="detail-label">Ngày sinh</span><strong>{formatDate('dateOfBirth' in profile ? profile.dateOfBirth || undefined : undefined)}</strong></div><div><span className="detail-label">Tuổi</span><strong>{'age' in profile && profile.age !== undefined && profile.age !== null && profile.age !== '' ? String(profile.age) : 'Chưa cập nhật'}</strong></div>{'address' in profile && <div className="span-two"><span className="detail-label">Địa chỉ</span><strong>{toAddressText(profile.address)}</strong></div>}<div><span className="detail-label">Trạng thái</span><span className={`badge ${getAccountLabel(profile) === 'pending' ? 'neutral' : ['locked', 'rejected'].includes(getAccountLabel(profile)) ? 'rejected' : 'approved'}`}>{getStatusText(getAccountLabel(profile))}</span></div></div>
    <ProfileImages profile={profile} />
    {(profile.gender || profile.province || profile.ward || profile.district) && <div className="profile-grid"><div><span className="detail-label">Giới tính</span><strong>{profile.gender || 'Chưa cập nhật'}</strong></div><div><span className="detail-label">Tỉnh / Quận / Huyện</span><strong>{[profile.ward || profile.district, profile.province].filter(Boolean).join(', ') || 'Chưa cập nhật'}</strong></div></div>}
    {profile.role === 'tutor' && <>
      <div className="detail-section"><span className="detail-label">Trạng thái hồ sơ</span><strong>{profile.tutorStatus || profile.approvalStatus}</strong>{profile.rejectionReason && <p>Lý do từ chối: {profile.rejectionReason}</p>}</div>
      <div className="profile-grid">{(['title', 'university', 'major', 'educationLevel', 'educationStatus', 'startYear', 'graduationYear', 'experienceYears', 'teachingMethod', 'achievements', 'teachingAreas', 'travelRadius', 'priceUnit', 'onlinePrice', 'offlinePrice', 'strengths'] as const).map((key, i) => profile[key] ? <div key={key}><span className="detail-label">{['Tiêu đề', 'Trường', 'Chuyên ngành', 'Trình độ', 'Tình trạng học tập', 'Năm bắt đầu', 'Năm tốt nghiệp', 'Số năm kinh nghiệm', 'Phương pháp', 'Thành tích', 'Khu vực dạy', 'Bán kính (km)', 'Đơn vị học phí', 'Học phí Online', 'Học phí trực tiếp', 'Điểm mạnh'][i]}</span><p>{profile[key]}</p></div> : null)}</div>
      <div className="detail-section"><span className="detail-label">Lịch rảnh</span>{profile.availability?.map((slot, i) => <p key={i}>{slot.dayOfWeek}: {slot.startTime} – {slot.endTime}</p>)}</div>
      <div className="document-grid">{profile.certificates?.map((certificate, i) => <div key={i}><strong>{certificate.name}</strong><small>{certificate.issuer} · {certificate.issuedAt} – {certificate.expiresAt || 'Không hết hạn'}</small><img src={imageSource(certificate.image)} alt={certificate.name} /></div>)}</div>
      {profile.verification && <div className="detail-section"><span className="detail-label">Giấy tờ xác minh — chỉ quản trị viên</span><div className="document-grid">{(['front', 'back', 'portrait'] as const).map((key, i) => profile.verification?.[key] ? <div key={key}><strong>{['CCCD mặt trước', 'CCCD mặt sau', 'Chân dung'][i]}</strong><img src={imageSource(profile.verification[key])} alt={key} /></div> : null)}</div></div>}
    </>}
    {(profile.role === 'tutor' || profile.approvalStatus) && <><div className="detail-section"><span className="detail-label">Môn có thể dạy</span><div className="tags">{profile.subjects?.map(item => <span key={item}>{item}</span>) || <small>Chưa cập nhật</small>}</div></div><div className="detail-section"><span className="detail-label">Lớp có thể dạy</span><div className="tags">{profile.grades?.map(item => <span className="light" key={item}>{item}</span>) || <small>Chưa cập nhật</small>}</div></div><div className="detail-section"><span className="detail-label">Kinh nghiệm</span><p>{profile.experience || 'Chưa cập nhật'}</p></div><div className="detail-section"><span className="detail-label">Giới thiệu</span><p>{profile.bio || 'Chưa cập nhật'}</p></div><div className="detail-section"><span className="detail-label">Trạng thái duyệt</span><span className={`badge ${getApprovalLabel(profile.approvalStatus) === 'rejected' ? 'rejected' : getApprovalLabel(profile.approvalStatus) === 'pending' ? 'neutral' : 'approved'}`}>{getStatusText(getApprovalLabel(profile.approvalStatus))}</span></div></>}
    <div className="modal-actions"><button type="button" className="view-button" onClick={onEdit}>Sửa thông tin</button><button type="button" className="primary compact" onClick={onClose}>Đóng</button></div>
  </section></div>
);

const EditProfileModal = ({profile, creating = false, onClose, onSave}: {profile: Profile; creating?: boolean; onClose: () => void; onSave: (payload: Record<string, any>) => Promise<void>}) => {
  const formState = {
    displayName: profile.displayName || '',
    email: profile.email || '',
    password: '',
    confirmPassword: '',
    phoneNumber: profile.phoneNumber || '',
    dateOfBirth: 'dateOfBirth' in profile && profile.dateOfBirth ? profile.dateOfBirth : '',
    age: 'age' in profile && profile.age !== undefined && profile.age !== null && profile.age !== '' ? String(profile.age) : '',
    address: profile.address || '',
    documentBase64: profile.documentBase64 || '',
    photoURL: profile.photoURL || profile.avatarBase64 || profile.avatarUrl || '',
    degreeImageBase64: profile.degreeImageBase64 || '',
    certificateImageBase64: profile.certificateImageBase64 || '',
    subjects: profile.subjects || [],
    grades: profile.grades || [],
    experience: profile.experience || '',
    bio: profile.bio || '',
  };
  const [form, setForm] = useState(formState);
  const [address, setAddress] = useState<AddressState>(parseAddress(form.address));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [readingFiles, setReadingFiles] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const close = () => { if (!saving && !readingFiles) onClose(); };

  const updateField = <K extends keyof typeof formState,>(key: K, value: typeof formState[K]) => {
    setForm(current => ({...current, [key]: value}));
    if (error) setError('');
  };

  const handleFile = (key: 'documentBase64' | 'photoURL' | 'degreeImageBase64' | 'certificateImageBase64', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 200 * 1024) { setError('Chọn ảnh PNG, JPEG, WebP hoặc GIF tối đa 200 KB.'); return; }
    const reader = new FileReader();
    setReadingFiles(count => count + 1);
    reader.onload = () => updateField(key, String(reader.result || ''));
    reader.onerror = () => setError('Không thể đọc ảnh. Vui lòng chọn lại.');
    reader.onloadend = () => setReadingFiles(count => count - 1);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || readingFiles) return;
    setError('');

    const payload: Record<string, any> = {
      displayName: form.displayName.trim(),
      phoneNumber: form.phoneNumber.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      age: form.age ? Number(form.age) : null,
      address: toAddressText(address) === 'Chưa cập nhật' ? null : toAddressText(address),
      documentBase64: form.documentBase64 || null,
      photoURL: form.photoURL || null,
      ...(creating && {email: form.email.trim(), password: form.password}),
      ...(profile.role === 'tutor' && {degreeImageBase64: form.degreeImageBase64 || null, certificateImageBase64: form.certificateImageBase64 || null, subjects: form.subjects, grades: form.grades, experience: form.experience, bio: form.bio}),
    };

    if (!payload.displayName) {
      setError('Tên không được để trống.');
      return;
    }
    if (creating && (form.password.length < 8 || form.password !== form.confirmPassword)) {
      setError('Mật khẩu phải có ít nhất 8 ký tự và nhập lại khớp nhau.'); return;
    }
    if (creating && !/^(0\d{9}|\+84\d{9})$/.test(form.phoneNumber.replace(/[\s().-]/g, ''))) {
      setError('Vui lòng nhập số điện thoại Việt Nam hợp lệ.'); return;
    }
    if (creating && profile.role === 'tutor' && (!payload.subjects.length || !payload.grades.length)) {
      setError('Vui lòng nhập môn dạy và lớp dạy.'); return;
    }
    if (new Blob([JSON.stringify(payload)]).size > 890000) {
      setError('Tổng dung lượng hồ sơ quá lớn. Vui lòng chọn ảnh nhỏ hơn.'); return;
    }

    try {
      setSaving(true);
      await onSave(payload);
      onClose();
    } catch (caught: any) {
      setError(caught?.message || 'Cập nhật không thành công.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onClick={close}><section className="profile-modal register-modal" role="dialog" aria-modal="true" aria-label={creating ? 'Thêm tài khoản' : 'Sửa thông tin'} onClick={event => event.stopPropagation()}>
    <div className="modal-header"><div><p className="eyebrow">{creating ? 'ĐĂNG KÝ TÀI KHOẢN' : 'CHỈNH SỬA THÔNG TIN'}</p><h2>{creating ? profile.role === 'tutor' ? 'Thêm gia sư' : 'Thêm người dùng' : profile.displayName}</h2></div><button className="icon-button modal-close" disabled={saving || !!readingFiles} onClick={close}><X size={20} /></button></div>
    <form className="register-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field"><span>Họ và tên *</span><input required value={form.displayName} onChange={event => updateField('displayName', event.target.value)} /></label>
        <label className="field"><span>Email{creating ? ' *' : ''}</span><input type="email" required={creating} value={form.email} disabled={!creating} onChange={event => updateField('email', event.target.value)} /></label>
        {creating && <>{(['password', 'confirmPassword'] as const).map(key => <label className="field" key={key}><span>{key === 'password' ? 'Mật khẩu *' : 'Nhập lại mật khẩu *'}</span><div className="password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={form[key]} onChange={event => updateField(key, event.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>)}</>}
        <label className="field"><span>Số điện thoại{creating ? ' *' : ''}</span><input type="tel" required={creating} value={form.phoneNumber} onChange={event => updateField('phoneNumber', event.target.value)} /></label>
        <label className="field"><span>Ngày sinh</span><input type="date" lang="vi" max={new Date().toLocaleDateString('en-CA')} value={form.dateOfBirth} onChange={event => updateField('dateOfBirth', event.target.value)} /></label>
        <label className="field"><span>Tuổi</span><input type="number" min="1" value={form.age} onChange={event => updateField('age', event.target.value)} /></label>
        <div className="field field-full"><span>Địa chỉ</span><AddressSelector value={address} onChange={setAddress} /></div>
      </div>
      {profile.role === 'tutor' && <div className="form-grid">
        {(['subjects', 'grades'] as const).map(key => <fieldset className="teaching-options" key={key}>
          <legend>{key === 'subjects' ? 'Môn dạy' : 'Lớp dạy'}{creating ? ' *' : ''}</legend>
          <small>Chọn một hoặc nhiều {key === 'subjects' ? 'môn học' : 'lớp học'}</small>
          <div className="teaching-choices">{[...new Set([...(key === 'subjects' ? SUBJECT_OPTIONS : GRADE_OPTIONS), ...form[key]])].map(option => <label className={`teaching-choice${form[key].includes(option) ? ' selected' : ''}`} key={option}>
            <input type="checkbox" checked={form[key].includes(option)} onChange={event => updateField(key, event.target.checked ? [...form[key], option] : form[key].filter(value => value !== option))} />
            <span>{option === 'Anh văn' ? 'Anh' : option}</span>
          </label>)}</div>
        </fieldset>)}
        {(['experience', 'bio'] as const).map((key, i) => <label className="field" key={key}><span>{['Kinh nghiệm', 'Giới thiệu'][i]}</span><textarea value={form[key]} onChange={event => updateField(key, event.target.value)} /></label>)}
      </div>}
      {(['photoURL', 'documentBase64', ...(profile.role === 'tutor' ? ['degreeImageBase64', 'certificateImageBase64'] as const : [])] as const).map(key => <div className="detail-section" key={key}><span className="detail-label">{{photoURL: 'Ảnh đại diện', documentBase64: 'Giấy tờ', degreeImageBase64: 'Bằng cấp', certificateImageBase64: 'Chứng chỉ'}[key]}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => handleFile(key, event)} />{form[key] && <img className="profile-document" src={imageSource(form[key])} alt="Ảnh đã chọn" />}</div>)}
      {error && <div className="error-banner form-error">{error}</div>}
      {creating && profile.role === 'tutor' && <p className="muted">Gia sư được tạo tại đây sẽ được duyệt và có thể đăng nhập ngay.</p>}
      <div className="modal-actions register-actions"><button type="button" className="view-button" disabled={saving || !!readingFiles} onClick={close}>Hủy</button><button type="submit" className="primary compact" disabled={saving || !!readingFiles}>{readingFiles ? 'Đang đọc ảnh...' : saving ? 'Đang lưu...' : creating ? 'Tạo tài khoản' : 'Lưu thay đổi'}</button></div>
    </form>
  </section></div>
};

const RegisterStaffModal = ({onClose, onSubmit}: {onClose: () => void; onSubmit: (payload: {email: string; password: string; displayName: string; phoneNumber?: string; dateOfBirth?: string; age?: number; address?: string}) => Promise<void>}) => {
  const [form, setForm] = useState({displayName: '', email: '', phoneNumber: '', password: '', confirmPassword: '', dateOfBirth: '', age: '', address: ''});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState<AddressState>({province: '', district: '', ward: '', detail: ''});

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(current => ({...current, [field]: value}));
    if (formError) setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = form.displayName.trim();
    const trimmedEmail = form.email.trim();
    const addressText = toAddressText(address);

    if (!trimmedName || !trimmedEmail || !form.password || !form.confirmPassword) {
      setFormError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (form.age && Number.isNaN(Number(form.age))) {
      setFormError('Tuổi phải là số hợp lệ.');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        displayName: trimmedName,
        email: trimmedEmail,
        password: form.password,
        phoneNumber: form.phoneNumber.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        age: form.age ? Number(form.age) : undefined,
        address: addressText === 'Chưa cập nhật' ? undefined : addressText,
      });
      onClose();
    } catch (caught: any) {
      setFormError(caught?.message || 'Không thể tạo tài khoản quản trị.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}><section className="profile-modal register-modal" onClick={event => event.stopPropagation()}>
    <div className="modal-header"><div><p className="eyebrow">ĐĂNG KÝ TÀI KHOẢN</p><h2>Thêm admin phụ</h2></div><button className="icon-button modal-close" onClick={onClose}><X size={20} /></button></div>
    <form className="register-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field"><span>Họ và tên</span><input value={form.displayName} onChange={event => handleChange('displayName', event.target.value)} placeholder="Nhập họ tên" /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={event => handleChange('email', event.target.value)} placeholder="name@example.com" /></label>
        <label className="field"><span>Số điện thoại</span><input type="tel" autoComplete="tel" value={form.phoneNumber} onChange={event => handleChange('phoneNumber', event.target.value)} placeholder="0912 345 678" /></label>
        <label className="field"><span>Ngày sinh</span><input type="date" lang="vi" max={new Date().toLocaleDateString('en-CA')} value={form.dateOfBirth} onChange={event => handleChange('dateOfBirth', event.target.value)} /></label>
        <label className="field"><span>Tuổi</span><input type="number" min="1" value={form.age} onChange={event => handleChange('age', event.target.value)} placeholder="18" /></label>
        <label className="field"><span>Mật khẩu</span><div className="password-wrap"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={event => handleChange('password', event.target.value)} placeholder="Ít nhất 8 ký tự" /><button type="button" className="password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <label className="field"><span>Nhập lại mật khẩu</span><div className="password-wrap"><input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={event => handleChange('confirmPassword', event.target.value)} placeholder="Nhập lại mật khẩu" /><button type="button" className="password-toggle" aria-label={showConfirmPassword ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} onClick={() => setShowConfirmPassword(value => !value)}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <div className="field field-full"><span>Địa chỉ</span><AddressSelector value={address} onChange={setAddress} /></div>
      </div>
      {formError && <div className="error-banner form-error">{formError}</div>}
      <div className="modal-actions register-actions"><button type="button" className="view-button" onClick={onClose}>Hủy</button><button type="submit" className="primary compact" disabled={submitting}>{submitting ? 'Đang lưu...' : 'Tạo tài khoản'}</button></div>
    </form>
  </section></div>
};

const AdminDashboard = ({user, role}: Props) => {
  const [tab, setTab] = useState<'review' | 'parents' | 'tutors' | 'staff' | 'revenue' | 'jobs' | 'contracts' | 'operations'>('review');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [staff, setStaff] = useState<StaffAdmin[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {setMenuOpen(false);}, [tab]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revenue, setRevenue] = useState<{total: number; count: number} | null>(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [registerOpen, setRegisterOpen] = useState(false);
  const [creatingRole, setCreatingRole] = useState<'user' | 'tutor' | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'review') setTutors(await listUsers('tutor'));
      if (tab === 'parents') setUsers(await listUsers('user'));
      if (tab === 'tutors') setUsers(await listUsers('tutor'));
      if (tab === 'staff' && role === 'super_admin') setStaff(await listStaff());
      if (tab === 'revenue' && role === 'super_admin') setRevenue(await getRevenue(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`));
    } catch (caught: any) { setError(caught.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, role]);

  const review = async (tutor: Tutor, status: 'approved' | 'rejected') => {
    const reason = status === 'rejected' ? window.prompt('Nhập lý do từ chối để gia sư sửa và gửi lại hồ sơ:') : undefined;
    if (status === 'rejected' && !reason?.trim()) return;
    try { await updateTutorStatus(tutor.id, status, reason || undefined); await load(); }
    catch (caught: any) { setError(caught.message); }
  };

  const toggleStatus = async (item: ManagedUser) => {
    const status = getAccountLabel(item) === 'locked' ? 'active' : 'locked';
    try { await updateUserStatus(item.id, status); await load(); }
    catch (caught: any) { setError(caught.message); }
  };

  const addStaff = async (payload: {email: string; password: string; displayName: string; phoneNumber?: string; dateOfBirth?: string; age?: number; address?: string}) => {
    try {
      await createStaff({
        ...payload,
        dateOfBirth: payload.dateOfBirth,
        age: payload.age,
        address: payload.address,
      });
      await load();
    } catch (caught: any) {
      setError(caught.message);
      throw caught;
    }
  };

  const saveProfile = async (item: Profile, payload: Record<string, any>) => {
    if (item.role === 'tutor' || item.role === 'user') {
      const role = item.role === 'tutor' || item.approvalStatus !== undefined ? 'tutor' : 'user';
      const updated = await updateUserProfile(role, item.id, payload);
      setUsers(current => current.map(userItem => userItem.id === item.id ? {...userItem, ...updated} : userItem));
      setTutors(current => current.map(tutor => tutor.id === item.id ? {...tutor, ...updated} : tutor));
      setSelectedProfile(updated);
      return;
    }

    const updated = await updateStaff(item.id, payload);
    setStaff(current => current.map(staffItem => staffItem.id === item.id ? {...staffItem, ...updated} : staffItem));
    setSelectedProfile(updated);
  };

  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  const matchesSearch = (item: Profile) => {
    const term = normalizeSearch(query);
    return normalizeSearch(`${item.displayName} ${item.email} ${item.phoneNumber || ''}`).includes(term)
      || (!!term && /^[+\d\s().-]+$/.test(term) && !!item.phoneNumber && item.phoneNumber.replace(/\D/g, '').includes(term.replace(/\D/g, '')));
  };
  const matchesFilter = (item: Profile) => matchesSearch(item) && (statusFilter === 'all' || getAccountLabel(item) === statusFilter);
  const filtered = users.filter(matchesFilter);
  const filteredTutors = tutors.filter(matchesFilter);
  const filteredStaff = staff.filter(matchesFilter);
  useEffect(() => { setQuery(''); setStatusFilter(tab === 'review' ? 'pending' : 'all'); }, [tab]);

  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'menu-open' : ''}`}><div className="logo"><span>TC</span><div>TutorConnect<small>ADMIN CONSOLE</small></div></div><button type="button" className="mobile-menu-toggle" aria-label={menuOpen ? "Đóng menu quản trị" : "Mở menu quản trị"} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}<span>Danh mục</span></button><nav id="admin-navigation" aria-label="Menu quản trị">
    <button type="button" className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}><ShieldCheck size={18} /> Duyệt hồ sơ</button>
    <button type="button" className={tab === 'parents' ? 'active' : ''} onClick={() => setTab('parents')}><UserRound size={18} /> Người dùng</button>
    <button type="button" className={tab === 'tutors' ? 'active' : ''} onClick={() => setTab('tutors')}><UserRound size={18} /> Gia sư</button>
    <button type="button" className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}><UserRound size={18} /> Bài đăng tìm gia sư</button>
    <button type="button" className={tab === 'contracts' ? 'active' : ''} onClick={() => setTab('contracts')}><DollarSign size={18} /> Gói học và từ chối</button>
    <button type="button" className={tab === 'operations' ? 'active' : ''} onClick={() => setTab('operations')}><UserRound size={18} /> Theo dõi học tập</button>
    {role === 'super_admin' && <><button type="button" className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}><UserRound size={18} /> Quản lý admin</button><button type="button" className={tab === 'revenue' ? 'active' : ''} onClick={() => setTab('revenue')}><DollarSign size={18} /> Doanh thu</button></>}
  </nav><div className="sidebar-footer"><div className="avatar">{user.email?.[0].toUpperCase()}</div><div><strong>{user.email}</strong><small>{role === 'super_admin' ? 'Super administrator' : 'Staff administrator'}</small></div><button aria-label="Đăng xuất" title="Đăng xuất" className="icon-button" onClick={() => signOut(auth)}><LogOut size={17} /></button></div></aside>
  <main className="content"><header><div><p className="eyebrow">{role === 'super_admin' ? 'Toàn quyền vận hành' : 'Quản lý người dùng'}</p><h1>{tab === 'operations' ? '\u0054heo d\u00f5i h\u1ecdc t\u1eadp' : tab === 'contracts' ? '\u0047\u00f3i h\u1ecdc v\u00e0 h\u1ee3p \u0111\u1ed3ng' : tab === 'review' ? 'Duyệt hồ sơ gia sư' : tab === 'parents' ? 'Quản lý người dùng' : tab === 'tutors' ? 'Quản lý gia sư' : tab === 'staff' ? 'Admin phụ' : tab === 'jobs' ? 'Bài đăng tìm gia sư' : 'Doanh thu'}</h1><p className="muted">Xem chi tiết, theo dõi và quản lý tài khoản.</p></div><div className="status-chip"><span /> Hệ thống đang hoạt động</div></header>{error && <div className="error-banner">{error}</div>}
    {tab !== 'operations' && tab !== 'revenue' && tab !== 'jobs' && tab !== 'contracts' && <div className="management-toolbar"><div className="search"><Search size={18} /><input type="search" aria-label="Tìm kiếm tài khoản" placeholder="Tìm theo họ tên, email hoặc số điện thoại..." value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Lọc trạng thái tài khoản" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option>{(tab === 'review' || tab === 'tutors' ? ['active', 'pending', 'draft', 'rejected', 'locked'] : ['active', 'locked']).map(status => <option key={status} value={status}>{getStatusText(status)}</option>)}</select>{(tab === 'parents' || tab === 'tutors') && <button className="primary compact" onClick={() => setCreatingRole(tab === 'parents' ? 'user' : 'tutor')}><Plus size={16} />{tab === 'parents' ? 'Thêm người dùng' : 'Thêm gia sư'}</button>}{tab === 'staff' && <button className="primary compact" onClick={() => setRegisterOpen(true)}><Plus size={16} /> Thêm admin phụ</button>}</div>}
    {tab === 'review' && <section className="table-wrap"><table><thead><tr><th>Ứng viên</th><th>Môn/lớp</th><th>Trạng thái</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={4} className="empty">Đang tải...</td></tr> : filteredTutors.length === 0 ? <tr><td colSpan={4} className="empty">Không tìm thấy hồ sơ phù hợp.</td></tr> : filteredTutors.map(item => <tr key={item.id}><td data-label="Ứng viên">{item.displayName}<small>{item.email}</small></td><td data-label="Môn/lớp">{item.subjects?.join(', ')}</td><td data-label="Trạng thái"><span className={`badge ${getApprovalLabel(item.approvalStatus) === 'rejected' ? 'rejected' : getApprovalLabel(item.approvalStatus) === 'pending' ? 'neutral' : 'approved'}`}>{getStatusText(getAccountLabel(item))}</span></td><td data-label="Thao tác"><div className="table-actions"><button className="view-button" onClick={() => setSelectedProfile(item)}><Eye size={15} /> Xem thông tin</button> <button disabled={!['pending', 'rejected'].includes(getAccountLabel(item))} className="approve" onClick={() => review(item, 'approved')}><Check size={15} /> Duyệt</button> <button disabled={!['pending', 'active'].includes(getAccountLabel(item))} className="reject" onClick={() => review(item, 'rejected')}>Từ chối</button></div></td></tr>)}</tbody></table></section>}
    {(tab === 'parents' || tab === 'tutors') && <section className="table-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Trạng thái</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={4} className="empty">Đang tải...</td></tr> : filtered.length === 0 ? <tr><td colSpan={4} className="empty">Không tìm thấy tài khoản phù hợp.</td></tr> : filtered.map(item => <tr key={item.id}><td data-label="Họ tên">{item.displayName}</td><td data-label="Email">{item.email}</td><td data-label="Trạng thái"><span className={`badge ${getAccountLabel(item) === 'pending' ? 'neutral' : ['locked', 'rejected'].includes(getAccountLabel(item)) ? 'rejected' : 'approved'}`}>{getStatusText(getAccountLabel(item))}</span></td><td data-label="Thao tác"><div className="table-actions"><button className="view-button" onClick={() => setSelectedProfile(item)}><Eye size={15} /> Xem thông tin</button> <button className={getAccountLabel(item) === 'locked' ? 'approve' : 'reject'} onClick={() => toggleStatus(item)}>{getAccountLabel(item) === 'locked' ? 'Mở khóa' : 'Khóa'}</button></div></td></tr>)}</tbody></table></section>}
    {tab === 'staff' && <section className="table-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Trạng thái</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={4} className="empty">Đang tải...</td></tr> : filteredStaff.length === 0 ? <tr><td colSpan={4} className="empty">Không tìm thấy admin phù hợp.</td></tr> : filteredStaff.map(item => <tr key={item.id}><td data-label="Họ tên">{item.displayName}</td><td data-label="Email">{item.email}</td><td data-label="Trạng thái"><span className={`badge ${item.disabled ? 'rejected' : 'approved'}`}>{item.disabled ? 'Đã khóa' : 'Hoạt động'}</span></td><td data-label="Thao tác"><div className="table-actions"><button className="view-button" onClick={() => setSelectedProfile(item)}><Eye size={15} /> Xem thông tin</button><button className="reject" onClick={async () => {if (window.confirm('Xóa admin này?')) { await deleteStaff(item.id); setStaff(items => items.filter(value => value.id !== item.id)); }}}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></section>}
    {tab === 'revenue' && <><section className="revenue-controls"><label>Từ ngày<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><button className="primary compact" onClick={load}>Xem báo cáo</button></section><section className="metrics"><div><span>Tổng doanh thu</span><strong>{revenue ? revenue.total.toLocaleString('vi-VN') : '—'} đ</strong></div><div><span>Số giao dịch</span><strong>{revenue?.count ?? '—'}</strong></div></section></>}
    {tab === 'jobs' && <JobManagement />}{tab === 'contracts' && <ContractManagement />}{tab === 'operations' && <LearningOperations />}
  </main>
  {selectedProfile && <DetailModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} onEdit={() => { setEditingProfile(selectedProfile); setSelectedProfile(null); }} />}
  {editingProfile && <EditProfileModal profile={editingProfile} onClose={() => setEditingProfile(null)} onSave={async payload => { await saveProfile(editingProfile, payload); setEditingProfile(null); await load(); }} />}
  {registerOpen && <RegisterStaffModal onClose={() => setRegisterOpen(false)} onSubmit={addStaff} />}
  {creatingRole && <EditProfileModal creating profile={{id: '', displayName: '', email: '', role: creatingRole}} onClose={() => setCreatingRole(null)} onSave={async payload => {
    const created = await createUser(creatingRole, {...payload, displayName: payload.displayName, email: payload.email, password: payload.password});
    setQuery('');
    setUsers(current => [created, ...current]);
    setSelectedProfile(created);
  }} />}
  </div>;
};

export default AdminDashboard;
