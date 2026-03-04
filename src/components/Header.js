import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaSignOutAlt, FaBars, FaTimes } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import Swal from "sweetalert2";
import logo from "../assets/img/logo_eagle.png";
import help_desk from "../assets/img/help_desk.png";
import "../App.css";
import "./Header.css";

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [profileDetails, setProfileDetails] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const dropdownRef = useRef(null);
    const mobileMenuRef = useRef(null);

    const populateProfileDetails = async () => {
        try {
            const response = await apiFetch("/api/login/get-user-profile", {
                method: "GET",
                credentials: "include",
            });
            if (response.status === 401) { navigate("/login"); return; }
            if (!response.ok) throw new Error("Error fetching profile details");
            const data = await response.json();
            setProfileDetails(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        populateProfileDetails();
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
                setIsMobileMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        try {
            const response = await apiFetch("/api/login/logout", {
                method: "POST",
                credentials: "include",
            });
            if (response.ok) {
                localStorage.clear();
                sessionStorage.clear();
                navigate("/login");
            } else {
                Swal.fire("Logout failed!");
            }
        } catch (error) {
            Swal.fire("An error occurred while logging out.");
            console.error(error);
        }
    };

    const handleCopyEmail = (email) => {
        navigator.clipboard.writeText(email)
            .then(() => Swal.fire({ icon: "success", title: "Copied!", text: `${email} copied to clipboard`, timer: 1500, showConfirmButton: false }))
            .catch(() => Swal.fire({ icon: "error", title: "Oops...", text: "Failed to copy email!" }));
    };

    const isAddClient = location.pathname.toLowerCase().includes("/add-client");
    const isDashboard = location.pathname.toLowerCase() === "/dashboard";

    const navLinks = [
        { label: "Dashboard", path: "/dashboard" },
        { label: "Reports", path: "/reports" },
        { label: "Settings", path: "/settings" },
    ];

    return (
        <div className="topbar">

            {/* ── Brand ── */}
            <div className="brand" onClick={() => navigate("/dashboard")}>
                <img src={logo} alt="logo" />
                <span>PerformAI Review</span>
            </div>

            {/* ── Desktop Nav ── */}
            <div className="nav-links">
                {navLinks.map(({ label, path }) => (
                    <span
                        key={label}
                        className={location.pathname.toLowerCase() === path ? "active" : ""}
                        onClick={() => navigate(path)}
                    >
                        {label}
                    </span>
                ))}
            </div>

            {/* ── Desktop Right Section ── */}
            <div className="right-section">
                {!isAddClient && (
                    <button className="add-btn" onClick={() => navigate("/add-client")}>
                        + Add Client
                    </button>
                )}
                <div className="divider" />

                <div
                    className="profile-wrapper"
                    ref={dropdownRef}
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                >
                    {profileDetails ? (
                        <>
                            <div className="profile-circle">
                                <div
                                    className="profile-avatar"
                                    style={{ backgroundColor: profileDetails.profile_color, color: "white", fontSize: "14px", fontWeight: "600" }}
                                >
                                    {profileDetails.profile_letters}
                                </div>
                            </div>

                            {isDropdownOpen && (
                                <div className="profile-dropdown">
                                    <div className="profile-dropdown-header">
                                        <div className="profile-name">
                                            {profileDetails.emp_first_name} {profileDetails.emp_last_name}
                                        </div>
                                        <div className="profile-subtitle">Your Form, Your Space</div>
                                    </div>

                                    <div className="profile-item" onClick={(e) => { e.stopPropagation(); handleCopyEmail("info@dolluzcorp.com"); }}>
                                        <img src={help_desk} className="help-desk-img" alt="Help" />
                                        info@dolluzcorp.com
                                    </div>

                                    <div className="profile-divider" />

                                    <div className="profile-item logout" onClick={(e) => { e.stopPropagation(); handleLogout(); }}>
                                        <FaSignOutAlt /> Logout
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="profile-avatar-skeleton" />
                    )}
                </div>
            </div>

            {/* ── Mobile Hamburger ── */}
            <button
                className="hamburger-btn"
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                aria-label="Toggle menu"
            >
                {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
            </button>

            {/* ── Mobile Menu Drawer ── */}
            {isMobileMenuOpen && (
                <div className="mobile-menu" ref={mobileMenuRef}>
                    <div className="mobile-menu-inner">

                        {/* Profile row */}
                        {profileDetails && (
                            <div className="mobile-profile-row">
                                <div
                                    className="profile-avatar"
                                    style={{ backgroundColor: profileDetails.profile_color, color: "white", fontSize: "14px", fontWeight: "600", width: "38px", height: "38px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                    {profileDetails.profile_letters}
                                </div>
                                <div>
                                    <div className="profile-name">{profileDetails.emp_first_name} {profileDetails.emp_last_name}</div>
                                    <div className="profile-subtitle">Your Form, Your Space</div>
                                </div>
                            </div>
                        )}

                        <div className="mobile-divider" />

                        {/* Nav links */}
                        {navLinks.map(({ label, path }) => (
                            <div
                                key={label}
                                className={`mobile-nav-item ${location.pathname.toLowerCase() === path ? "active" : ""}`}
                                onClick={() => navigate(path)}
                            >
                                {label}
                            </div>
                        ))}

                        <div className="mobile-divider" />

                        {/* Add Client */}
                        {!isAddClient && (
                            <div className="mobile-nav-item mobile-add-btn" onClick={() => navigate("/add-client")}>
                                + Add Client
                            </div>
                        )}

                        {/* Help email */}
                        <div className="mobile-nav-item" onClick={() => handleCopyEmail("info@dolluzcorp.com")}>
                            <img src={help_desk} className="help-desk-img" alt="Help" />
                            info@dolluzcorp.com
                        </div>

                        {/* Logout */}
                        <div className="mobile-nav-item logout" onClick={handleLogout}>
                            <FaSignOutAlt style={{ marginRight: "8px" }} /> Logout
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Header;