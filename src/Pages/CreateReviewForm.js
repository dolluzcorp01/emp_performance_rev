import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import logo_eagle from "../assets/img/logo_eagle.png";
import { FaCamera } from "react-icons/fa";
import { apiFetch, API_BASE } from "../utils/api";
import "./CreateReviewForm.css";

const QUALITIES = [
    "Works to Full Potential", "Quality of Work", "Work Consistency",
    "Communication", "Independent Work", "Takes Initiative", "Group Work",
    "Productivity", "Creativity", "Honesty", "Integrity", "Coworker Relations",
    "Client Relations", "Technical Skills", "Dependability", "Punctuality", "Attendance",
];

const RATINGS = ["Unsatisfactory", "Satisfactory", "Good", "Excellent"];

const RATING_CLASS = {
    Unsatisfactory: "crf-selected-unsatisfactory",
    Satisfactory: "crf-selected-satisfactory",
    Good: "crf-selected-good",
    Excellent: "crf-selected-excellent",
};

const defaultFormState = () => ({
    lastReviewDate: "",
    department: "",
    reviewerName: "",
    reviewerTitle: "",
    todayDate: "",
    ratings: {},
    customQualities: ["", "", ""],
    customRatings: { 0: "", 1: "", 2: "" },
    achievedGoals: "",
    nextGoals: "",
    comments: "",
    hrSignDate: "",
    reviewerSignDate: "",
});

// ── Reusable linked-dropdown field ────────────────────────────
// Shows a text input; on focus opens a dropdown filtered by what the user types.
// `displayKey`   : which property of the employee to show in the input
// `filterKey`    : same as displayKey (what to filter by as user types)
const EmpField = ({ label, displayKey, employees, selectedEmp, onSelect, onClear }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Sync input text whenever selectedEmp changes from outside
    useEffect(() => {
        if (selectedEmp) {
            setQuery(
                displayKey === "emp_id"
                    ? String(selectedEmp.emp_id)
                    : displayKey === "job_name"
                        ? selectedEmp.job_name || ""
                        : selectedEmp.full_name
            );
        } else {
            setQuery("");
        }
    }, [selectedEmp, displayKey]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const getDisplayValue = (emp) => {
        if (displayKey === "emp_id") return String(emp.emp_id);
        if (displayKey === "job_name") return emp.job_name || "(No position)";
        return emp.full_name;
    };

    const filtered = employees.filter(emp =>
        getDisplayValue(emp).toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="crf-field-group">
            <label>{label}</label>
            <div className="crf-emp-search-wrapper" ref={wrapperRef}>
                <input
                    type="text"
                    placeholder={`Search by ${label.toLowerCase()}...`}
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        if (!e.target.value) onClear();
                    }}
                />
                {selectedEmp && (
                    <button type="button" className="crf-emp-clear" onClick={() => { onClear(); setQuery(""); }}>×</button>
                )}

                {open && (
                    <div className="crf-emp-dropdown">
                        {filtered.length > 0 ? (
                            filtered.map(emp => (
                                <div
                                    key={emp.emp_id}
                                    className={`crf-emp-option ${selectedEmp?.emp_id === emp.emp_id ? "crf-emp-option--selected" : ""}`}
                                    onClick={() => { onSelect(emp); setOpen(false); }}
                                >
                                    <div className="crf-emp-avatar" style={{ background: emp.profile_color }}>
                                        {emp.profile_letters}
                                    </div>
                                    <div>
                                        <div className="crf-emp-option-name">{emp.full_name}</div>
                                        <div className="crf-emp-option-meta">
                                            <span>ID: {emp.emp_id}</span>
                                            {emp.job_name && <span> · {emp.job_name}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="crf-emp-empty">No match found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
const CreateReviewForm = () => {
    const { clientId } = useParams();

    const [form, setForm] = useState(defaultFormState());
    const [submitted, setSubmitted] = useState(false);
    const [clientLogoPreview, setClientLogoPreview] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [clientEmployees, setClientEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);   // single source of truth

    // ── Fetch client ─────────────────────────────────────────────
    useEffect(() => {
        if (!clientId) return;
        fetchClientData();
    }, [clientId]);

    const fetchClientData = async () => {
        try {
            const res = await apiFetch(`/api/client-config/get-client/${clientId}`, {
                method: "GET", credentials: "include",
            });
            if (!res.ok) throw new Error();
            const data = await res.json();

            setClientData(data);
            setClientEmployees(data.employees || []);

            setForm(prev => ({
                ...prev,
                department: data.department || data.company_name || "",
                reviewerName: data.poc_name || "",
                reviewerTitle: data.poc_role || "",
            }));

            if (data.company_logo) {
                setClientLogoPreview(`${API_BASE}/${data.company_logo}`);
            }
        } catch (err) {
            console.error("Error fetching client data:", err);
        }
    };

    // ── When an employee is selected from ANY of the 3 fields ────
    const handleSelectEmployee = (emp) => setSelectedEmployee(emp);
    const handleClearEmployee = () => setSelectedEmployee(null);

    // ── Other form handlers ──────────────────────────────────────
    const handleField = (field, value) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const handleRating = (qi, value) =>
        setForm(prev => ({ ...prev, ratings: { ...prev.ratings, [qi]: value } }));

    const handleCustomQuality = (idx, value) =>
        setForm(prev => {
            const updated = [...prev.customQualities];
            updated[idx] = value;
            return { ...prev, customQualities: updated };
        });

    const handleCustomRating = (idx, value) =>
        setForm(prev => ({ ...prev, customRatings: { ...prev.customRatings, [idx]: value } }));

    const handleReset = () => {
        if (window.confirm("Reset all fields?")) {
            setForm(prev => ({
                ...defaultFormState(),
                department: prev.department,
                reviewerName: prev.reviewerName,
                reviewerTitle: prev.reviewerTitle,
            }));
            setSubmitted(false);
            setSelectedEmployee(null);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            ...form,
            employeeName: selectedEmployee?.full_name || "",
            employeeId: selectedEmployee?.emp_id || "",
            positionHeld: selectedEmployee?.job_name || "",
            clientId,
        };
        setSubmitted(true);
        console.log("Review submitted:", payload);
        // TODO: wire to API via apiFetch
    };

    // ── Rating chips ─────────────────────────────────────────────
    const RatingChips = ({ namePrefix, selected, onChange, disabled = false }) => (
        <div className="crf-rating-options">
            {RATINGS.map((rating) => {
                const isSelected = selected === rating;
                const chipClass = [
                    "crf-rating-chip",
                    isSelected ? RATING_CLASS[rating] : "",
                    disabled ? "crf-disabled" : "",
                ].filter(Boolean).join(" ");
                return (
                    <label key={rating} className={chipClass}>
                        <input type="radio" name={namePrefix} value={rating}
                            checked={isSelected} disabled={disabled}
                            onChange={() => onChange(rating)} />
                        {rating}
                    </label>
                );
            })}
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    return (
        <div className="crf-page-wrapper">
            <Header />

            <div className="crf-container">

                {/* ── Hero ── */}
                <div className="crf-hero">
                    <div className="crf-hero-left">
                        <div className="crf-logo-display">
                            {clientLogoPreview
                                ? <img src={clientLogoPreview} alt="Client logo" className="crf-logo-img" />
                                : <><FaCamera className="crf-camera-icon" /><span>Client Logo</span></>
                            }
                        </div>
                        {clientData && <p className="crf-client-name">{clientData.company_name}</p>}
                    </div>

                    <div className="crf-hero-center">
                        <h1 className="crf-page-title">Employee Performance Review</h1>
                        <p className="crf-page-sub">Complete all sections carefully. Ratings are saved automatically.</p>
                    </div>

                    <div className="crf-hero-right">
                        <img src={logo_eagle} alt="PerformAI logo" className="crf-brand-logo" />
                    </div>
                </div>

                {submitted && <div className="crf-success-banner">✅ Review submitted successfully!</div>}

                <form id="review-form" onSubmit={handleSubmit}>

                    {/* ── Employee Information ── */}
                    <div className="crf-card">
                        <div className="crf-card-header">Employee Information</div>

                        {/* Linked employee notice */}
                        {selectedEmployee && (
                            <div className="crf-emp-selected-banner">
                                ✅ <strong>{selectedEmployee.full_name}</strong> selected —
                                ID: {selectedEmployee.emp_id}
                                {selectedEmployee.job_name && ` · ${selectedEmployee.job_name}`}
                                <button type="button" onClick={handleClearEmployee} className="crf-emp-banner-clear">
                                    Change employee
                                </button>
                            </div>
                        )}

                        <div className="crf-info-grid">

                            {/* ── Employee Name dropdown ── */}
                            <EmpField
                                label="Employee Name"
                                displayKey="full_name"
                                employees={clientEmployees}
                                selectedEmp={selectedEmployee}
                                onSelect={handleSelectEmployee}
                                onClear={handleClearEmployee}
                            />

                            {/* Department — locked from client */}
                            <div className="crf-field-group">
                                <label>Department</label>
                                <input type="text" value={form.department} disabled className="crf-input-readonly" />
                            </div>

                            {/* ── Employee ID dropdown ── */}
                            <EmpField
                                label="Employee ID"
                                displayKey="emp_id"
                                employees={clientEmployees}
                                selectedEmp={selectedEmployee}
                                onSelect={handleSelectEmployee}
                                onClear={handleClearEmployee}
                            />

                            {/* Reviewer Name — locked from client POC */}
                            <div className="crf-field-group">
                                <label>Reviewer Name</label>
                                <input type="text" value={form.reviewerName} disabled className="crf-input-readonly" />
                            </div>

                            {/* ── Position Held dropdown ── */}
                            <EmpField
                                label="Position Held"
                                displayKey="job_name"
                                employees={clientEmployees}
                                selectedEmp={selectedEmployee}
                                onSelect={handleSelectEmployee}
                                onClear={handleClearEmployee}
                            />

                            {/* Reviewer Title — locked */}
                            <div className="crf-field-group">
                                <label>Reviewer Title</label>
                                <input type="text" value={form.reviewerTitle} disabled className="crf-input-readonly" />
                            </div>

                            <div className="crf-field-group">
                                <label>Last Review Date</label>
                                <input type="date"
                                    value={form.lastReviewDate}
                                    onClick={(e) => {
                                        e.target.showPicker?.();
                                    }}
                                    onChange={(e) => handleField("lastReviewDate", e.target.value)} />
                            </div>

                            <div className="crf-field-group">
                                <label>Today's Date</label>
                                <input
                                    type="date"
                                    disabled
                                    value={new Date().toISOString().split("T")[0]}
                                    onChange={(e) => handleField("todayDate", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Characteristics ── */}
                    <div className="crf-card">
                        <div className="crf-card-header">Characteristics</div>
                        <p className="crf-card-subtext">Select one rating per quality indicator.</p>
                        <div className="crf-qualities-list">
                            {QUALITIES.map((quality, qi) => (
                                <div className="crf-quality-item" key={qi}>
                                    <div className="crf-quality-label">{quality}</div>
                                    <RatingChips
                                        namePrefix={`quality-${qi}`}
                                        selected={form.ratings[qi] || ""}
                                        onChange={(val) => handleRating(qi, val)}
                                    />
                                </div>
                            ))}
                            {[0, 1, 2].map((idx) => (
                                <div className="crf-quality-item crf-quality-item--custom" key={`custom-${idx}`}>
                                    <input type="text" className="crf-custom-quality-input"
                                        placeholder="Add custom quality (optional)..."
                                        value={form.customQualities[idx]}
                                        onChange={(e) => handleCustomQuality(idx, e.target.value)} />
                                    <RatingChips
                                        namePrefix={`custom-quality-${idx}`}
                                        selected={form.customRatings[idx] || ""}
                                        onChange={(val) => handleCustomRating(idx, val)}
                                        disabled={!form.customQualities[idx]}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Goals ── */}
                    <div className="crf-card">
                        <div className="crf-card-header">Goals</div>
                        <div className="crf-field-group">
                            <label>Achieved Goals Set in Previous Review</label>
                            <textarea rows={4} placeholder="Describe the goals that were achieved..."
                                value={form.achievedGoals}
                                onChange={(e) => handleField("achievedGoals", e.target.value)} />
                        </div>
                        <div className="crf-field-group" style={{ marginTop: "16px" }}>
                            <label>Goals for Next Review Period</label>
                            <textarea rows={4} placeholder="Outline goals for the upcoming review cycle..."
                                value={form.nextGoals}
                                onChange={(e) => handleField("nextGoals", e.target.value)} />
                        </div>
                    </div>

                    {/* ── Feedback & Approval ── */}
                    <div className="crf-card">
                        <div className="crf-card-header">Feedback &amp; Approval</div>
                        <div className="crf-field-group">
                            <label>Comments</label>
                            <textarea rows={5} placeholder="Additional comments or observations..."
                                value={form.comments}
                                onChange={(e) => handleField("comments", e.target.value)} />
                        </div>
                        <div className="crf-signature-row">
                            <div className="crf-sig-block">
                                <div className="crf-field-group">
                                    <label>HR Signature</label>
                                    <input type="text" value={form.hrSignDate}
                                        onChange={(e) => handleField("hrSignDate", e.target.value)} />
                                    <div className="crf-sig-line" />
                                </div>
                                <span className="crf-sig-caption">HR Signature</span>
                            </div>
                            <div className="crf-sig-block">
                                <div className="crf-field-group">
                                    <label>Reviewer Signature</label>
                                    <input type="text"
                                        value={form.reviewerName}
                                        onChange={(e) => handleField("reviewerSignDate", e.target.value)} />
                                    <div className="crf-sig-line" />
                                </div>
                                <span className="crf-sig-caption">Reviewer Signature</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="crf-form-footer">
                        <span className="crf-footer-note">
                            Dolluz – Employee Performance Review Q1 Cycle (JAN – MAR '2025)
                        </span>
                        <div className="crf-footer-btns">
                            <button type="button" className="crf-btn-outline" onClick={handleReset}>↺ Reset</button>
                            <button type="submit" className="crf-btn-primary">Submit Review →</button>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CreateReviewForm;