import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import logo_eagle from "../assets/img/logo_eagle.png";
import { FaCamera, FaArrowLeft, FaShare } from "react-icons/fa";
import Swal from "sweetalert2";
import { apiFetch, API_BASE } from "../utils/api";
import "./ReviewFormPage.css";

// ─────────────────────────────────────────────────────────────
const QUALITIES = [
    "Works to Full Potential", "Quality of Work", "Work Consistency",
    "Communication", "Independent Work", "Takes Initiative", "Group Work",
    "Productivity", "Creativity", "Honesty", "Integrity", "Coworker Relations",
    "Client Relations", "Technical Skills", "Dependability", "Punctuality", "Attendance",
];

const RATINGS = ["Unsatisfactory", "Satisfactory", "Good", "Excellent"];

const RATING_CLASS = {
    Unsatisfactory: "rfp-selected-unsatisfactory",
    Satisfactory: "rfp-selected-satisfactory",
    Good: "rfp-selected-good",
    Excellent: "rfp-selected-excellent",
};

const defaultFormState = () => ({
    lastReviewDate: "",
    department: "",
    reviewerName: "",
    reviewerTitle: "",
    ratings: {},
    customQualities: ["", "", ""],
    customRatings: { 0: "", 1: "", 2: "" },
    achievedGoals: "",
    nextGoals: "",
    comments: "",
    hrSignature: "",
    reviewerSignature: "",
});

// ── Reusable tri-linked employee dropdown ─────────────────────
// reviewedIds = Set of emp_ids already reviewed this quarter → greyed out
const EmpField = ({ label, displayKey, employees, selectedEmp, onSelect, onClear, disabled, reviewedIds = new Set() }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (selectedEmp) {
            setQuery(
                displayKey === "emp_id" ? String(selectedEmp.emp_id) :
                    displayKey === "job_name" ? (selectedEmp.job_name || "") :
                        selectedEmp.full_name
            );
        } else {
            setQuery("");
        }
    }, [selectedEmp, displayKey]);

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
        <div className="rfp-field-group">
            <label>{label}</label>
            <div className="rfp-emp-search-wrapper" ref={wrapperRef}>
                <input
                    type="text"
                    placeholder={disabled ? "—" : `Search by ${label.toLowerCase()}...`}
                    value={query}
                    disabled={disabled}
                    onFocus={() => !disabled && setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        if (!e.target.value) onClear();
                    }}
                    className={disabled ? "rfp-input-readonly" : ""}
                />
                {selectedEmp && !disabled && (
                    <button type="button" className="rfp-emp-clear"
                        onClick={() => { onClear(); setQuery(""); }}>×</button>
                )}
                {open && !disabled && (
                    <div className="rfp-emp-dropdown">
                        {filtered.length > 0 ? filtered.map(emp => {
                            const alreadyReviewed = reviewedIds.has(String(emp.emp_id));
                            return (
                                <div
                                    key={emp.emp_id}
                                    className={[
                                        "rfp-emp-option",
                                        selectedEmp?.emp_id === emp.emp_id ? "rfp-emp-option--selected" : "",
                                        alreadyReviewed ? "rfp-emp-option--reviewed" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => {
                                        if (alreadyReviewed) return;
                                        onSelect(emp);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="rfp-emp-avatar"
                                        style={{ background: alreadyReviewed ? "#d1d5db" : emp.profile_color }}>
                                        {emp.profile_letters}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="rfp-emp-option-name"
                                            style={{ color: alreadyReviewed ? "#9ca3af" : undefined }}>
                                            {emp.full_name}
                                        </div>
                                        <div className="rfp-emp-option-meta">
                                            <span>ID: {emp.emp_id}</span>
                                            {emp.job_name && <span> · {emp.job_name}</span>}
                                        </div>
                                    </div>
                                    {alreadyReviewed && (
                                        <span className="rfp-emp-reviewed-tag">✓ This quarter</span>
                                    )}
                                </div>
                            );
                        }) : (
                            <div className="rfp-emp-empty">No match found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Rating Chips ──────────────────────────────────────────────
const RatingChips = ({ namePrefix, selected, onChange, disabled = false }) => (
    <div className="rfp-rating-options">
        {RATINGS.map((rating) => {
            const isSelected = selected === rating;
            const chipClass = [
                "rfp-rating-chip",
                isSelected ? RATING_CLASS[rating] : "",
                disabled ? "rfp-disabled" : "",
            ].filter(Boolean).join(" ");
            return (
                <label key={rating} className={chipClass}>
                    <input type="radio" name={namePrefix} value={rating}
                        checked={isSelected} disabled={disabled}
                        onChange={() => !disabled && onChange(rating)} />
                    {rating}
                </label>
            );
        })}
    </div>
);

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
//  mode="preview"   → back + share, all fields disabled, no submit
//  mode="published" → auth guard, quarter enforcement, submit & close / continue
// ─────────────────────────────────────────────────────────────
const ReviewFormPage = ({ mode = "preview" }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { clientId } = useParams();

    const isPreview = mode === "preview";
    const isPublished = mode === "published";

    const [form, setForm] = useState(defaultFormState());
    const [clientLogoPreview, setClientLogoPreview] = useState(null);
    const [clientData, setClientData] = useState(null);
    const [clientEmployees, setClientEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [authChecked, setAuthChecked] = useState(isPreview);
    const [reviewedIds, setReviewedIds] = useState(new Set()); // emp_ids done this quarter

    // ── Auth guard ────────────────────────────────────────────
    useEffect(() => {
        if (!isPublished) return;

        const verifyAuth = async () => {
            try {
                const res = await apiFetch("/api/review/verify_auth", { credentials: "include" });
                if (!res.ok) throw new Error("Unauthorized");
                setAuthChecked(true);
            } catch {
                sessionStorage.setItem("redirectAfterLogin", location.pathname);
                navigate("/login");
            }
        };
        verifyAuth();
    }, [isPublished]);

    // ── Fetch client + reviewed IDs ───────────────────────────
    useEffect(() => {
        if (!clientId || !authChecked) return;
        fetchClientData();
        if (isPublished) fetchReviewedIds();
    }, [clientId, authChecked]);

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
            if (data.company_logo) setClientLogoPreview(`${API_BASE}/${data.company_logo}`);
        } catch (err) {
            console.error("Error fetching client data:", err);
        }
    };

    const fetchReviewedIds = async () => {
        try {
            const res = await apiFetch(`/api/review/reviewed-emp-ids/${clientId}`, {
                credentials: "include",
            });
            if (!res.ok) return;
            const data = await res.json();
            setReviewedIds(new Set(data.reviewed_ids || []));
        } catch (err) {
            console.error("Error fetching reviewed IDs:", err);
        }
    };

    // ── Employee selection with eligibility check ─────────────
    const handleSelectEmployee = async (emp) => {
        if (isPreview) { setSelectedEmployee(emp); return; }

        // Fast path: already in local reviewed set
        if (reviewedIds.has(String(emp.emp_id))) {
            showAlreadyReviewedAlert(emp.full_name);
            return;
        }

        // API double-check (catches race conditions from other sessions)
        try {
            const res = await apiFetch(`/api/review/check-eligibility/${clientId}/${emp.emp_id}`, {
                credentials: "include",
            });
            const data = await res.json();
            if (!data.eligible) {
                setReviewedIds(prev => new Set([...prev, String(emp.emp_id)]));
                Swal.fire({
                    icon: "warning",
                    title: "Already Reviewed This Quarter",
                    html: `<strong>${emp.full_name}</strong> was reviewed on
                           <strong>${new Date(data.reviewed_on).toLocaleDateString()}</strong>.<br/><br/>
                           Next review available from
                           <strong>${new Date(data.next_eligible_date).toLocaleDateString()}</strong>.`,
                    confirmButtonColor: "#2563eb",
                });
                return;
            }
        } catch { /* soft fail — allow selection */ }

        setSelectedEmployee(emp);
    };

    const showAlreadyReviewedAlert = (name) => {
        Swal.fire({
            icon: "warning",
            title: "Already Reviewed This Quarter",
            html: `<strong>${name}</strong> has already been reviewed this quarter.<br/>You can submit a new review next quarter.`,
            confirmButtonColor: "#2563eb",
        });
    };

    const handleClearEmployee = () => setSelectedEmployee(null);

    // ── Form handlers ─────────────────────────────────────────
    const handleField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
    const handleRating = (qi, val) => setForm(prev => ({ ...prev, ratings: { ...prev.ratings, [qi]: val } }));
    const handleCustomQuality = (idx, value) => setForm(prev => {
        const updated = [...prev.customQualities];
        updated[idx] = value;
        return { ...prev, customQualities: updated };
    });
    const handleCustomRating = (idx, val) => setForm(prev => ({ ...prev, customRatings: { ...prev.customRatings, [idx]: val } }));

    // ── Validation ────────────────────────────────────────────
    const validate = () => {
        if (!selectedEmployee) {
            Swal.fire({ icon: "warning", title: "Employee required", text: "Please select an employee before submitting.", confirmButtonColor: "#2563eb" });
            return false;
        }
        return true;
    };

    // ── Payload ───────────────────────────────────────────────
    const buildPayload = () => ({
        clientId,
        empId: selectedEmployee?.emp_id || "",
        employeeName: selectedEmployee?.full_name || "",
        positionHeld: selectedEmployee?.job_name || "",
        department: form.department,
        reviewerName: form.reviewerName,
        reviewerTitle: form.reviewerTitle,
        lastReviewDate: form.lastReviewDate,
        ratings: form.ratings,
        customQualities: form.customQualities,
        customRatings: form.customRatings,
        achievedGoals: form.achievedGoals,
        nextGoals: form.nextGoals,
        comments: form.comments,
        hrSignature: form.hrSignature,
        reviewerSignature: form.reviewerSignature,
    });

    // ── Submit core ───────────────────────────────────────────
    const submitReview = async () => {
        setIsSubmitting(true);
        try {
            const res = await apiFetch("/api/review/submit-review", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            });

            if (res.status === 409) {
                const data = await res.json();
                Swal.fire({
                    icon: "warning",
                    title: "Already Reviewed This Quarter",
                    html: data.message + `<br/>Next eligible: <strong>${new Date(data.next_eligible_date).toLocaleDateString()}</strong>`,
                    confirmButtonColor: "#2563eb",
                });
                fetchReviewedIds(); // refresh
                return false;
            }

            if (!res.ok) throw new Error();
            return true;
        } catch {
            Swal.fire({ icon: "error", title: "Submission failed", text: "Something went wrong. Please try again.", confirmButtonColor: "#ef4444" });
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Submit & Close ────────────────────────────────────────
    const handleSubmitAndClose = async () => {
        if (!validate()) return;
        const ok = await submitReview();
        if (!ok) return;
        await Swal.fire({ icon: "success", title: "Review Submitted!", text: "Thank you. You will now be logged out.", timer: 2500, showConfirmButton: false });
        try { await apiFetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch { }
        navigate("/login");
    };

    // ── Submit & Continue ─────────────────────────────────────
    const handleSubmitAndContinue = async () => {
        if (!validate()) return;
        const ok = await submitReview();
        if (!ok) return;

        // Immediately grey out submitted employee in dropdown
        if (selectedEmployee) {
            setReviewedIds(prev => new Set([...prev, String(selectedEmployee.emp_id)]));
        }

        setSelectedEmployee(null);
        setForm(prev => ({
            ...defaultFormState(),
            department: prev.department,
            reviewerName: prev.reviewerName,
            reviewerTitle: prev.reviewerTitle,
        }));

        Swal.fire({ icon: "success", title: "Review Saved!", text: "Form is ready for the next employee.", timer: 2000, showConfirmButton: false, position: "top-end", toast: true });
    };

    // ── Share ─────────────────────────────────────────────────
    const handleShare = () => {
        const url = `${window.location.origin}/review-form/${clientId}`;
        navigator.clipboard.writeText(url).then(() => {
            Swal.fire({ icon: "success", title: "Link Copied!", html: `Share this with employees:<br/><code style="font-size:12px;word-break:break-all">${url}</code>`, confirmButtonColor: "#2563eb" });
        }).catch(() => {
            Swal.fire({ icon: "info", title: "Share Link", text: url, confirmButtonColor: "#2563eb" });
        });
    };

    // ── Hero ──────────────────────────────────────────────────
    const HeroCard = () => (
        <div className="rfp-hero">
            <div className="rfp-hero-left">
                <div className="rfp-logo-display">
                    {clientLogoPreview
                        ? <img src={clientLogoPreview} alt="Client logo" className="rfp-logo-img" />
                        : <><FaCamera className="rfp-camera-icon" /><span>Logo</span></>
                    }
                </div>
                {clientData && <p className="rfp-client-name">{clientData.company_name}</p>}
            </div>
            <div className="rfp-hero-center">
                <h1 className="rfp-page-title">Employee Performance Review</h1>
                <p className="rfp-page-sub">Complete all sections carefully. Ratings are saved automatically.</p>
            </div>
            <div className="rfp-hero-right">
                <img src={logo_eagle} alt="PerformAI" className="rfp-brand-logo" />
            </div>
        </div>
    );

    if (!authChecked) {
        return (
            <div className="rfp-page-wrapper">
                <div className="rfp-loading"><div className="rfp-spinner" /><span>Verifying access...</span></div>
            </div>
        );
    }

    return (
        <div className="rfp-page-wrapper">
            {isPreview && <Header />}

            {/* ── Action bar ── */}
            {isPreview ? (
                <div className="rfp-action-bar">
                    <div className="rfp-back-link" onClick={() => navigate(`/client/${clientId}`)}>
                        <FaArrowLeft /><span>Back</span>
                    </div>
                    <HeroCard />
                    <button className="rfp-share-btn" type="button" onClick={handleShare}>
                        <FaShare /><span>Share</span>
                    </button>
                </div>
            ) : (
                <div className="rfp-action-bar rfp-action-bar--published">
                    <HeroCard />
                </div>
            )}

            <div className="rfp-container">

                {isPublished && (
                    <div className="rfp-published-notice">
                        🔒 This form is for authorized personnel only. Your submission will be recorded.
                    </div>
                )}

                {isPublished && reviewedIds.size > 0 && (
                    <div className="rfp-quarter-notice">
                        ℹ️ <strong>{reviewedIds.size}</strong> employee{reviewedIds.size > 1 ? "s have" : " has"} already been reviewed this quarter and cannot be re-selected.
                    </div>
                )}

                <form onSubmit={(e) => e.preventDefault()}>

                    {/* ── Employee Information ── */}
                    <div className="rfp-card">
                        <div className="rfp-card-header">Employee Information</div>

                        {selectedEmployee && (
                            <div className="rfp-emp-selected-banner">
                                ✅ <strong>{selectedEmployee.full_name}</strong> selected —
                                ID: {selectedEmployee.emp_id}
                                {selectedEmployee.job_name && ` · ${selectedEmployee.job_name}`}
                                {!isPreview && (
                                    <button type="button" onClick={handleClearEmployee} className="rfp-emp-banner-clear">
                                        Change employee
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="rfp-info-grid">
                            <EmpField label="Employee Name" displayKey="full_name"
                                employees={clientEmployees} selectedEmp={selectedEmployee}
                                onSelect={handleSelectEmployee} onClear={handleClearEmployee}
                                disabled={isPreview} reviewedIds={reviewedIds} />

                            <div className="rfp-field-group">
                                <label>Department</label>
                                <input type="text" value={form.department} disabled className="rfp-input-readonly" />
                            </div>

                            <EmpField label="Employee ID" displayKey="emp_id"
                                employees={clientEmployees} selectedEmp={selectedEmployee}
                                onSelect={handleSelectEmployee} onClear={handleClearEmployee}
                                disabled={isPreview} reviewedIds={reviewedIds} />

                            <div className="rfp-field-group">
                                <label>Reviewer Name</label>
                                <input type="text" value={form.reviewerName} disabled className="rfp-input-readonly" />
                            </div>

                            <EmpField label="Position Held" displayKey="job_name"
                                employees={clientEmployees} selectedEmp={selectedEmployee}
                                onSelect={handleSelectEmployee} onClear={handleClearEmployee}
                                disabled={isPreview} reviewedIds={reviewedIds} />

                            <div className="rfp-field-group">
                                <label>Reviewer Title</label>
                                <input type="text" value={form.reviewerTitle} disabled className="rfp-input-readonly" />
                            </div>

                            <div className="rfp-field-group">
                                <label>Last Review Date</label>
                                <input type="date" value={form.lastReviewDate}
                                    disabled={isPreview}
                                    onClick={(e) => !isPreview && e.target.showPicker?.()}
                                    onChange={(e) => handleField("lastReviewDate", e.target.value)}
                                    className={isPreview ? "rfp-input-readonly" : ""} />
                            </div>

                            <div className="rfp-field-group">
                                <label>Today's Date</label>
                                <input type="date" disabled value={new Date().toISOString().split("T")[0]} className="rfp-input-readonly" />
                            </div>
                        </div>
                    </div>

                    {/* ── Characteristics ── */}
                    <div className="rfp-card">
                        <div className="rfp-card-header">Characteristics</div>
                        <p className="rfp-card-subtext">Select one rating per quality indicator.</p>
                        <div className="rfp-qualities-list">
                            {QUALITIES.map((quality, qi) => (
                                <div className="rfp-quality-item" key={qi}>
                                    <div className="rfp-quality-label">{quality}</div>
                                    <RatingChips namePrefix={`quality-${qi}`}
                                        selected={form.ratings[qi] || ""} onChange={(val) => handleRating(qi, val)}
                                        disabled={isPreview} />
                                </div>
                            ))}
                            {[0, 1, 2].map((idx) => (
                                <div className="rfp-quality-item rfp-quality-item--custom" key={`custom-${idx}`}>
                                    <input type="text" className="rfp-custom-quality-input"
                                        placeholder={isPreview ? "Custom quality (preview)" : "Add custom quality (optional)..."}
                                        value={form.customQualities[idx]} disabled={isPreview}
                                        onChange={(e) => handleCustomQuality(idx, e.target.value)} />
                                    <RatingChips namePrefix={`custom-quality-${idx}`}
                                        selected={form.customRatings[idx] || ""}
                                        onChange={(val) => handleCustomRating(idx, val)}
                                        disabled={isPreview || !form.customQualities[idx]} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Goals ── */}
                    <div className="rfp-card">
                        <div className="rfp-card-header">Goals</div>
                        <div className="rfp-field-group">
                            <label>Achieved Goals Set in Previous Review</label>
                            <textarea rows={4} placeholder={isPreview ? "— preview only —" : "Describe the goals that were achieved..."}
                                value={form.achievedGoals} disabled={isPreview}
                                onChange={(e) => handleField("achievedGoals", e.target.value)} />
                        </div>
                        <div className="rfp-field-group" style={{ marginTop: "16px" }}>
                            <label>Goals for Next Review Period</label>
                            <textarea rows={4} placeholder={isPreview ? "— preview only —" : "Outline goals for the upcoming review cycle..."}
                                value={form.nextGoals} disabled={isPreview}
                                onChange={(e) => handleField("nextGoals", e.target.value)} />
                        </div>
                    </div>

                    {/* ── Feedback & Approval ── */}
                    <div className="rfp-card">
                        <div className="rfp-card-header">Feedback &amp; Approval</div>
                        <div className="rfp-field-group">
                            <label>Comments</label>
                            <textarea rows={5} placeholder={isPreview ? "— preview only —" : "Additional comments or observations..."}
                                value={form.comments} disabled={isPreview}
                                onChange={(e) => handleField("comments", e.target.value)} />
                        </div>
                        <div className="rfp-signature-row">
                            <div className="rfp-sig-block">
                                <div className="rfp-field-group">
                                    <label>HR Signature</label>
                                    <input type="text" placeholder={isPreview ? "—" : "Full name"}
                                        value={form.hrSignature} disabled={isPreview}
                                        onChange={(e) => handleField("hrSignature", e.target.value)} />
                                    <div className="rfp-sig-line" />
                                </div>
                                <span className="rfp-sig-caption">HR Signature</span>
                            </div>
                            <div className="rfp-sig-block">
                                <div className="rfp-field-group">
                                    <label>Reviewer Signature</label>
                                    <input type="text" placeholder={isPreview ? "—" : "Full name"}
                                        value={form.reviewerSignature} disabled={isPreview}
                                        onChange={(e) => handleField("reviewerSignature", e.target.value)} />
                                    <div className="rfp-sig-line" />
                                </div>
                                <span className="rfp-sig-caption">Reviewer Signature</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="rfp-form-footer">
                        <span className="rfp-footer-note">
                            Dolluz – Employee Performance Review Q1 Cycle (JAN – MAR '2025)
                        </span>
                        {isPreview && <div className="rfp-preview-badge">👁 Preview Mode — Submit disabled</div>}
                        {isPublished && (
                            <div className="rfp-footer-btns">
                                <button type="button" className="rfp-btn-outline"
                                    onClick={handleSubmitAndClose} disabled={isSubmitting}>
                                    {isSubmitting ? "Saving..." : "Submit & Close"}
                                </button>
                                <button type="button" className="rfp-btn-primary"
                                    onClick={handleSubmitAndContinue} disabled={isSubmitting}>
                                    {isSubmitting ? "Saving..." : "Submit & Continue →"}
                                </button>
                            </div>
                        )}
                    </div>

                </form>
            </div>
        </div>
    );
};

export default ReviewFormPage;