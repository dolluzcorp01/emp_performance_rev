import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../utils/api";
import logo_eagle from "../assets/img/logo_eagle.png";
import "../App.css";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const showToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 5000);
  };

  const verifyLogin = async () => {
    let hasError = false;

    if (!email.trim()) { setEmailError(true); hasError = true; }
    else setEmailError(false);

    if (!password.trim()) { setPasswordError(true); hasError = true; }
    else setPasswordError(false);

    if (hasError) {
      showToast("error", "Please fill all required fields.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch("/api/login/verifyLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        showToast("success", "Login successful! Redirecting...");
        setTimeout(() => {
          const redirectTo =
            location.state?.from ||
            sessionStorage.getItem("redirectAfterLogin") ||
            "/dashboard";
          sessionStorage.removeItem("redirectAfterLogin");
          navigate(redirectTo, { replace: true });
        }, 1000);
      } else {
        showToast("error", data.message || "Invalid email or password.");
        setIsLoading(false);
      }
    } catch (error) {
      showToast("error", "An error occurred. Please try again later.");
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">

      {/* ── Toast ── */}
      {toastMessage && (
        <div className={`toast-popup ${toastType}`}>
          <div className="toast-icon-container">
            <i className={`fa-solid ${toastType === "success" ? "fa-circle-check" : "fa-circle-xmark"}`} />
          </div>
          <div className="toast-text">{toastMessage}</div>
          <button className="toast-close" onClick={() => setToastMessage("")}>×</button>
        </div>
      )}

      <div className="login-container">

        {/* ══════════ LEFT ══════════ */}
        <div className="login-left">
          <div className="brand-icon">
            <img src={logo_eagle} alt="logo" className="logo-img" />
          </div>

          <h1>Empowering Every<br /><span>Performance.</span></h1>

          <p className="subtitle">
            The ultimate platform for continuous feedback, goal tracking, and
            professional growth within your organization.
          </p>

          <div className="feature">
            <i className="fa-regular fa-circle-check feature-check" />
            <div>
              <h4>Real-time Feedback</h4>
              <p>Bridge the gap between reviews with instant kudos and constructive notes.</p>
            </div>
          </div>

          <div className="feature">
            <i className="fa-regular fa-circle-check feature-check" />
            <div>
              <h4>Goal Alignment</h4>
              <p>Connect individual achievements directly to organizational milestones.</p>
            </div>
          </div>

          <div className="feature">
            <i className="fa-regular fa-circle-check feature-check" />
            <div>
              <h4>Secure &amp; Private</h4>
              <p>Enterprise-grade security ensuring all performance data stays protected.</p>
            </div>
          </div>

          <div className="trusted-section">
            <div className="avatars">
              <img src="https://i.pravatar.cc/30?img=1" alt="" />
              <img src="https://i.pravatar.cc/30?img=2" alt="" />
              <img src="https://i.pravatar.cc/30?img=3" alt="" />
              <img src="https://i.pravatar.cc/30?img=4" alt="" />
            </div>
            <span>Trusted by 500+ global enterprises</span>
          </div>
        </div>

        {/* ══════════ RIGHT ══════════ */}
        <div className="login-right">
          <div className="login-card">

            <h3 className="app-title">
              <img src={logo_eagle} alt="logo" className="app-title-logo" />
              Employee Performance Review
            </h3>

            <h2>Welcome Back</h2>
            <p className="login-desc">Please enter your details to sign in.</p>

            {/* Email */}
            <div className="field-group">
              <label>Work Email</label>
              <input
                type="email"
                className={emailError ? "input-error" : ""}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
                onKeyDown={(e) => e.key === "Enter" && verifyLogin()}
                disabled={isLoading}
              />
              {emailError && <span className="field-error">Email is required.</span>}
            </div>

            {/* Password */}
            <div className="field-group">
              <div className="password-row">
                <label>Password</label>
                <span className="forgot">Forgot password?</span>
              </div>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className={passwordError ? "input-error" : ""}
                  placeholder="Please enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && verifyLogin()}
                  disabled={isLoading}
                />
                <span className="toggle-password" onClick={() => setShowPassword(p => !p)}>
                  <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </span>
              </div>
              {passwordError && <span className="field-error">Password is required.</span>}
            </div>

            {/* Sign In */}
            <button
              className={`signin-btn ${isLoading ? "loading" : ""}`}
              onClick={verifyLogin}
              disabled={isLoading}
            >
              {isLoading
                ? <><span className="spinner" /> Signing in...</>
                : "Sign In →"
              }
            </button>

            <div className="or-divider"><span>OR CONTINUE WITH</span></div>

            <div className="social-buttons">
              <button className="social-btn" disabled={isLoading}>Google</button>
              <button className="social-btn" disabled={isLoading}>SSO</button>
            </div>

            <div className="support">
              Problems logging in? <span>Contact IT Support</span>
            </div>

            <div className="footer-links">
              Privacy Policy &nbsp;·&nbsp; Terms of Service &nbsp;·&nbsp; Cookie Settings
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;