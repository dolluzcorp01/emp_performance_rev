import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, API_BASE } from "../utils/api";
import { FaArrowLeft, FaBuilding, FaUser, FaUsers, FaCamera, FaClipboardList } from "react-icons/fa";
import Header from "../components/Header";
import Swal from "sweetalert2";
import "./ClientConfig.css";

const ClientConfig = () => {
    const navigate = useNavigate();
    const { clientId } = useParams();           // undefined = Add mode, set = Edit mode
    const isEditMode = Boolean(clientId);

    // ── Form state ──────────────────────────────────────────────────
    const [form, setForm] = useState({
        companyName: "",
        companyEmail: "",
        companyAddress: "",
        department: "",
        pocName: "",
        pocRole: "",
        pocEmail: "",
        pocPhone: "",
        clientStatus: "Active",
    });
    const [errors, setErrors] = useState({});
    const [logoPreview, setLogoPreview] = useState(null);   // shown in UI
    const [logoFile, setLogoFile] = useState(null);   // new file to upload
    const [existingLogoPath, setExistingLogoPath] = useState(null);   // path already in DB

    // ── Employee state ───────────────────────────────────────────────
    const [employees, setEmployees] = useState([]);     // selected employees
    const [employeeInput, setEmployeeInput] = useState("");
    const [employeesDetails, setEmployeesDetails] = useState([]);     // all employees from API
    const [showDropdown, setShowDropdown] = useState(false);

    // ── UI state ────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);
    const [lastSaved, setLastSaved] = useState(null);

    // ── Load data on mount ───────────────────────────────────────────
    useEffect(() => {
        fetchAllEmployees();

        if (isEditMode) {
            fetchClientData();
        } else {
            // 🔥 Reset everything when switching to Add mode
            setForm({
                companyName: "",
                companyEmail: "",
                companyAddress: "",
                department: "",
                pocName: "",
                pocRole: "",
                pocEmail: "",
                pocPhone: "",
                clientStatus: "Active",
            });

            setEmployees([]);
            setLogoPreview(null);
            setLogoFile(null);
            setExistingLogoPath(null);
            setErrors({});
            setLastSaved(null);
        }
    }, [clientId]);

    // Auto-save timestamp
    useEffect(() => {
        const hasData = Object.values(form).some(v => v.trim());
        if (!hasData) return;
        const timer = setTimeout(() => {
            setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }, 1000);
        return () => clearTimeout(timer);
    }, [form]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (!e.target.closest(".employee-search-wrapper")) setShowDropdown(false);
        };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    // ── API calls ────────────────────────────────────────────────────
    const fetchAllEmployees = async () => {
        try {
            const res = await apiFetch("/api/client-config/get-employees", {
                method: "GET", credentials: "include",
            });
            if (res.status === 401) { navigate("/login"); return; }
            if (!res.ok) throw new Error();
            setEmployeesDetails(await res.json());
        } catch { console.error("Failed to fetch employees"); }
    };

    const fetchClientData = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch(`/api/client-config/get-client/${clientId}`, {
                method: "GET", credentials: "include",
            });
            if (res.status === 401) { navigate("/login"); return; }
            if (!res.ok) throw new Error();
            const data = await res.json();

            setForm({
                companyName: data.company_name || "",
                companyEmail: data.company_email || "",
                companyAddress: data.company_address || "",
                department: data.department || "",
                pocName: data.poc_name || "",
                pocRole: data.poc_role || "",
                pocEmail: data.poc_email || "",
                pocPhone: data.poc_number || "",
                clientStatus: data.client_status || "Active",
            });

            if (data.company_logo) {
                setExistingLogoPath(data.company_logo);
                // Build a URL to display the existing logo
                setLogoPreview(`${API_BASE}/${data.company_logo}`);
            }

            setEmployees(data.employees || []);
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Failed to load client data." });
            navigate("/dashboard");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Field handlers ───────────────────────────────────────────────
    const handleField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            Swal.fire({ icon: "error", title: "Invalid file", text: "Please upload an image file.", timer: 2000, showConfirmButton: false });
            return;
        }
        if (file.size > 1 * 1024 * 1024) {
            Swal.fire({ icon: "warning", title: "File too large", text: "Logo must be under 1 MB.", timer: 2500, showConfirmButton: false });
            return;
        }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const removeEmployee = (index) => setEmployees(prev => prev.filter((_, i) => i !== index));

    // ── Validation ───────────────────────────────────────────────────
    const validate = () => {
        const e = {};
        if (!form.companyName.trim()) e.companyName = "Company name is required.";
        if (!form.companyEmail.trim()) e.companyEmail = "Company email is required.";
        if (!form.companyAddress.trim()) e.companyAddress = "Company Address is required.";
        if (!form.department.trim()) e.department = "Department is required.";
        else if (!/\S+@\S+\.\S+/.test(form.companyEmail)) e.companyEmail = "Enter a valid email.";
        if (!form.pocName.trim()) e.pocName = "Contact name is required.";
        if (!form.pocRole.trim()) e.pocRole = "Contact role is required.";
        if (!form.pocEmail.trim()) e.pocEmail = "Contact email is required.";
        else if (!/\S+@\S+\.\S+/.test(form.pocEmail)) e.pocEmail = "Enter a valid email.";
        if (employees.length === 0) e.employees = "At least one employee must be added.";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Submit ───────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validate()) {
            Swal.fire({ icon: "warning", title: "Please fix the errors", text: "Fill in all required fields.", timer: 2500, showConfirmButton: false });
            return;
        }
        setIsSubmitting(true);

        try {
            const fd = new FormData();
            fd.append("company_name", form.companyName);
            fd.append("company_email", form.companyEmail);
            fd.append("company_address", form.companyAddress);
            fd.append("department", form.department);
            fd.append("poc_name", form.pocName);
            fd.append("poc_role", form.pocRole);
            fd.append("poc_email", form.pocEmail);
            fd.append("poc_number", form.pocPhone);
            fd.append("client_status", form.clientStatus);
            fd.append("employee_ids", JSON.stringify(employees.map(e => e.emp_id)));
            if (logoFile) fd.append("company_logo", logoFile);

            const url = isEditMode
                ? `/api/client-config/update-client/${clientId}`
                : "/api/client-config/add-client";
            const method = isEditMode ? "PUT" : "POST";

            const res = await apiFetch(url, { method, body: fd, credentials: "include" });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Request failed");

            Swal.fire({
                icon: "success",
                title: isEditMode ? "Client Updated!" : "Client Saved!",
                text: `${form.companyName} has been ${isEditMode ? "updated" : "registered"}.`,
                timer: 2000,
                showConfirmButton: false,
            });
            navigate("/dashboard");
        } catch (err) {
            Swal.fire({ icon: "error", title: "Error", text: err.message || "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Filtered employee dropdown ───────────────────────────────────
    const filteredEmployees = employeesDetails
        .filter(emp => emp.full_name.toLowerCase().includes(employeeInput.toLowerCase()))
        .filter(emp => !employees.some(s => s.emp_id === emp.emp_id));

    // ── Render ───────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="page-wrapper">
                <Header />
                <div className="cc-loading">
                    <div className="cc-spinner" />
                    <p>Loading client data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <Header />

            <div className="cc-container">

                {/* ── Top bar ── */}
                <div className="cc-topbar">
                    <div className="cc-back-link" onClick={() => navigate("/dashboard")}>
                        <FaArrowLeft />
                        <span>Back to Client Directory</span>
                    </div>

                    {/* Edit mode: show Create Review button */}
                    {isEditMode && (
                        <button
                            className="cc-review-btn"
                            onClick={() => navigate(`/create-review/${clientId}`)}
                        >
                            <FaClipboardList />
                            Create Review Form
                        </button>
                    )}
                </div>

                {/* ── Page title ── */}
                <h1 className="cc-title">
                    {isEditMode ? "Edit Client Profile" : "Register New Client"}
                </h1>
                <p className="cc-subtitle">
                    {isEditMode
                        ? "Update organization details and employee roster."
                        : "Setup a new organization profile and initial employee roster."
                    }
                </p>

                <div className="cc-card">

                    {/* ══ STATUS (edit only) ══ */}
                    {isEditMode && (
                        <>
                            <div className="cc-status-row">
                                <span className="cc-status-label">Client Status</span>
                                <div className="cc-status-options">
                                    {["Active", "Inactive", "Pending"].map(s => (
                                        <label
                                            key={s}
                                            className={`cc-status-chip cc-status-${s.toLowerCase()} ${form.clientStatus === s ? "selected" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="clientStatus"
                                                value={s}
                                                checked={form.clientStatus === s}
                                                onChange={() => handleField("clientStatus", s)}
                                            />
                                            {s}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <hr className="cc-divider" />
                        </>
                    )}

                    {/* ══ COMPANY IDENTITY ══ */}
                    <div className="cc-section">
                        <div className="cc-section-header">
                            <div className="cc-section-icon"><FaBuilding /></div>
                            <div>
                                <h3>Company Identity</h3>
                                <p>Basic company details and branding.</p>
                            </div>
                        </div>

                        <div className="cc-company-row">
                            {/* Logo */}
                            <label className="cc-logo-upload" htmlFor="logo-input" title="Upload company logo">
                                {logoPreview
                                    ? <img src={logoPreview} alt="Logo" className="cc-logo-img" />
                                    : <><FaCamera className="cc-camera-icon" /><span>Upload Logo</span></>
                                }
                                <input id="logo-input" type="file" accept="image/*" hidden onChange={handleLogoChange} />
                            </label>
                            <div className="cc-logo-hint">Max 1 MB</div>

                            {/* Fields */}
                            <div className="cc-form-fields">
                                <div className="cc-field-group">
                                    <label>Company Name <span className="cc-req">*</span></label>
                                    <input placeholder="e.g. Global Tech Solutions"
                                        value={form.companyName}
                                        onChange={e => handleField("companyName", e.target.value)}
                                        className={errors.companyName ? "cc-error-input" : ""} />
                                    {errors.companyName && <span className="cc-error-msg">{errors.companyName}</span>}
                                </div>
                                <div className="cc-field-group">
                                    <label>Official Company Email <span className="cc-req">*</span></label>
                                    <input placeholder="contact@company.com"
                                        value={form.companyEmail}
                                        onChange={e => handleField("companyEmail", e.target.value)}
                                        className={errors.companyEmail ? "cc-error-input" : ""} />
                                    {errors.companyEmail && <span className="cc-error-msg">{errors.companyEmail}</span>}
                                </div>
                                <div className="cc-field-group">
                                    <label>
                                        Company Address <span className="cc-req">*</span>
                                    </label>
                                    <textarea
                                        placeholder="Enter full company address (Street, City, ZIP)..."
                                        value={form.companyAddress}
                                        onChange={e => handleField("companyAddress", e.target.value)}
                                        className={errors.companyAddress ? "cc-error-input" : ""}
                                    />
                                    {errors.companyAddress && (
                                        <span className="cc-error-msg">{errors.companyAddress}</span>
                                    )}
                                </div>

                                <div className="cc-field-group">
                                    <label>
                                        Department <span className="cc-req">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Human Resources, IT, Finance"
                                        value={form.department}
                                        onChange={e => handleField("department", e.target.value)}
                                        className={errors.department ? "cc-error-input" : ""}
                                    />
                                    {errors.department && (
                                        <span className="cc-error-msg">{errors.department}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="cc-divider" />

                    {/* ══ POINT OF CONTACT ══ */}
                    <div className="cc-section">
                        <div className="cc-section-header">
                            <div className="cc-section-icon"><FaUser /></div>
                            <div>
                                <h3>Point of Contact</h3>
                                <p>The primary individual responsible for account coordination.</p>
                            </div>
                        </div>

                        <div className="cc-two-col">
                            <div className="cc-field-group">
                                <label>Full Name <span className="cc-req">*</span></label>
                                <input placeholder="Jane Doe"
                                    value={form.pocName}
                                    onChange={e => handleField("pocName", e.target.value)}
                                    className={errors.pocName ? "cc-error-input" : ""} />
                                {errors.pocName && <span className="cc-error-msg">{errors.pocName}</span>}
                            </div>
                            <div className="cc-field-group">
                                <label>Role <span className="cc-req">*</span></label>
                                <input placeholder="e.g. HR Manager, IT Lead"
                                    value={form.pocRole}
                                    onChange={e => handleField("pocRole", e.target.value)}
                                    className={errors.pocRole ? "cc-error-input" : ""} />
                                {errors.pocRole && <span className="cc-error-msg">{errors.pocRole}</span>}
                            </div>
                        </div>

                        <div className="cc-two-col">
                            <div className="cc-field-group">
                                <label>Direct Email <span className="cc-req">*</span></label>
                                <input placeholder="jane.doe@company.com"
                                    value={form.pocEmail}
                                    onChange={e => handleField("pocEmail", e.target.value)}
                                    className={errors.pocEmail ? "cc-error-input" : ""} />
                                {errors.pocEmail && <span className="cc-error-msg">{errors.pocEmail}</span>}
                            </div>
                            <div className="cc-field-group">
                                <label>Phone Number</label>
                                <input placeholder="+1 (555) 000-0000"
                                    value={form.pocPhone}
                                    onChange={e => handleField("pocPhone", e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <hr className="cc-divider" />

                    {/* ══ EMPLOYEE ROSTER ══ */}
                    <div className="cc-section">
                        <div className="cc-section-header">
                            <div className="cc-section-icon"><FaUsers /></div>
                            <div>
                                <h3>Employee Roster</h3>
                                <p>Add employees to this client. You can bulk import via CSV later.</p>
                            </div>
                        </div>

                        <div className="employee-search-wrapper">
                            <input
                                className={`cc-input cc-employee-input ${errors.employees ? "cc-error-input" : ""}`}
                                placeholder="Search and add employees..."
                                value={employeeInput}
                                onFocus={() => setShowDropdown(true)}
                                onChange={e => {
                                    setEmployeeInput(e.target.value);
                                    setShowDropdown(true);
                                    if (errors.employees) {
                                        setErrors(prev => ({ ...prev, employees: "" }));
                                    }
                                }}
                            />
                            {errors.employees && (
                                <span className="cc-error-msg">{errors.employees}</span>
                            )}
                            {showDropdown && (
                                <div className="cc-dropdown">
                                    {filteredEmployees.length > 0 ? (
                                        filteredEmployees.map(emp => (
                                            <div key={emp.emp_id} className="cc-dropdown-option"
                                                onClick={() => {
                                                    setEmployees(prev => [...prev, emp]);
                                                    setEmployeeInput("");
                                                    setShowDropdown(false);
                                                }}>
                                                <div className="cc-emp-avatar" style={{ background: emp.profile_color }}>
                                                    {emp.profile_letters}
                                                </div>
                                                <div>
                                                    <div className="cc-emp-name">{emp.full_name}</div>
                                                    {emp.designation && <div className="cc-emp-role">{emp.designation}</div>}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="cc-dropdown-empty">
                                            {employeeInput ? `No results for "${employeeInput}"` : "No more employees to add"}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {employees.length > 0 && (
                            <div className="cc-tags">
                                {employees.map((emp, i) => (
                                    <div className="cc-tag" key={emp.emp_id}>
                                        <div className="cc-tag-avatar" style={{ background: emp.profile_color }}>
                                            {emp.profile_letters}
                                        </div>
                                        <span>{emp.full_name}</span>
                                        <button className="cc-tag-remove" onClick={() => removeEmployee(i)}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {employees.length > 0 && (
                            <p className="cc-roster-count">{employees.length} employee{employees.length !== 1 ? "s" : ""} added</p>
                        )}

                        <div className="cc-pro-tip">
                            💡 <strong>Pro Tip:</strong> Once saved, head to "Roster Management" to assign departments and roles.
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="cc-form-footer">
                        <span className="cc-draft">
                            {lastSaved ? `✓ Draft auto-saved at ${lastSaved}` : "Changes will be auto-saved"}
                        </span>
                        <div className="cc-footer-actions">
                            <button className="cc-cancel-btn" onClick={() => navigate("/dashboard")}>
                                Cancel
                            </button>
                            <button className="cc-save-btn" onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting
                                    ? (isEditMode ? "Updating..." : "Saving...")
                                    : (isEditMode ? "Update Client Profile" : "Save Client Profile")
                                }
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ClientConfig;