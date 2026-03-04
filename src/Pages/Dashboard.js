import React, { useState, useEffect, useMemo } from "react";
import { FaFilter, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { apiFetch, API_BASE } from "../utils/api";
import Header from "../components/Header";
import "../App.css";
import "./Dashboard.css";

const PAGE_SIZE = 8;

const Dashboard = () => {
    const navigate = useNavigate();

    // ── Data state ────────────────────────────────────────────────
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // ── Filter / sort / page state ────────────────────────────────
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Statuses");
    const [sort, setSort] = useState("Newest First");
    const [page, setPage] = useState(1);

    // ── Fetch clients from API ────────────────────────────────────
    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/api/client-config/get-clients", {
                method: "GET",
                credentials: "include",
            });
            if (res.status === 401) { navigate("/login"); return; }
            if (!res.ok) throw new Error("Failed to fetch clients");
            const data = await res.json();
            setClients(data);
        } catch (err) {
            setError("Could not load clients. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Derived / filtered list ───────────────────────────────────
    const filtered = useMemo(() => {
        let list = [...clients];

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.company_name.toLowerCase().includes(q) ||
                c.poc_name.toLowerCase().includes(q)
            );
        }

        if (statusFilter !== "All Statuses") {
            list = list.filter(c => c.client_status === statusFilter);
        }

        // API returns newest first by default; reverse for Oldest First
        if (sort === "Oldest First") list = [...list].reverse();

        return list;
    }, [clients, search, statusFilter, sort]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearch = (v) => { setSearch(v); setPage(1); };
    const handleStatus = (v) => { setStatusFilter(v); setPage(1); };
    const handleSort = (v) => { setSort(v); setPage(1); };

    // ── Stats derived from live data ──────────────────────────────
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.client_status === "Active").length;
    const pendingClients = clients.filter(c => c.client_status === "Pending").length;

    // ── Pagination page number list ───────────────────────────────
    const pageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push("...");
            for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++)
                pages.push(i);
            if (page < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };

    // ── Avatar: logo image if available, otherwise initials ──────
    const renderAvatar = (client) => {
        const initials = client.company_name
            .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

        if (client.company_logo) {
            return (
                <div className="avatar avatar-img">
                    <img
                        src={`${API_BASE}/${client.company_logo}`}
                        alt={client.company_name}
                        onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.classList.remove("avatar-img");
                            e.target.parentElement.innerHTML =
                                `<span class="avatar-initials">${initials}</span>`;
                        }}
                    />
                </div>
            );
        }
        return (
            <div className="avatar">
                <span className="avatar-initials">{initials}</span>
            </div>
        );
    };

    // ─────────────────────────────────────────────────────────────
    return (
        <div className="page-wrapper">
            <Header />
            <div className="dashboard">

                {/* ── PAGE HEADER ── */}
                <div className="page-header">
                    <div>
                        <h2>Clients</h2>
                        <p>Manage and monitor employee performance reviews across your portfolio.</p>
                    </div>
                    <div className="stats">
                        <div className="stat-box">
                            <small>Total Clients</small>
                            <h4>{isLoading ? "—" : totalClients}</h4>
                        </div>
                        <div className="stat-box">
                            <small>Active</small>
                            <h4>{isLoading ? "—" : activeClients}</h4>
                        </div>
                        <div className="stat-box">
                            <small>Pending</small>
                            <h4>{isLoading ? "—" : pendingClients}</h4>
                        </div>
                    </div>
                </div>

                {/* ── FILTERS ── */}
                <div className="filters">
                    <div className="search-box">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search clients by name or POC..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        {search && (
                            <button className="search-clear" onClick={() => handleSearch("")}>
                                <i className="fa-solid fa-x" />
                            </button>
                        )}
                    </div>

                    <div className="filter-actions">
                        <div className="filter-title">
                            <FaFilter className="filter-icon" />
                            <span>Filter By:</span>
                        </div>
                        <select value={statusFilter} onChange={(e) => handleStatus(e.target.value)}>
                            <option>All Statuses</option>
                            <option>Active</option>
                            <option>Inactive</option>
                            <option>Pending</option>
                        </select>
                        <select value={sort} onChange={(e) => handleSort(e.target.value)}>
                            <option>Newest First</option>
                            <option>Oldest First</option>
                        </select>
                    </div>
                </div>

                {/* ── RESULTS COUNT ── */}
                {(search || statusFilter !== "All Statuses") && !isLoading && (
                    <p className="results-count">
                        Showing <strong>{filtered.length}</strong> result{filtered.length !== 1 ? "s" : ""}
                        {search && <> for "<em>{search}</em>"</>}
                    </p>
                )}

                {/* ── LOADING ── */}
                {isLoading && (
                    <div className="dashboard-loading">
                        <div className="dashboard-spinner" />
                        <p>Loading clients...</p>
                    </div>
                )}

                {/* ── ERROR ── */}
                {!isLoading && error && (
                    <div className="empty-state">
                        <div className="empty-icon">⚠️</div>
                        <p>{error}</p>
                        <button onClick={fetchClients}>Retry</button>
                    </div>
                )}

                {/* ── CLIENT GRID ── */}
                {!isLoading && !error && (
                    <>
                        {paginated.length > 0 ? (
                            <div className="client-grid">
                                {paginated.map((client) => (
                                    <div
                                        className="client-card"
                                        key={client.client_id}
                                        onClick={() => navigate(`/client/${client.client_id}`)}
                                        title={`Open ${client.company_name}`}
                                    >
                                        <div className={`status ${client.client_status.toLowerCase()}`}>
                                            {client.client_status}
                                        </div>

                                        {renderAvatar(client)}

                                        <h4>{client.company_name}</h4>
                                        <p className="poc">POC: {client.poc_name}</p>
                                        <p className="poc">Role: {client.poc_role}</p>
                                        <p className="poc">Mail: {client.poc_email}</p>

                                        <div className="card-footer">
                                            <span>{client.employee_count} Employee{client.employee_count !== 1 ? "s" : ""}</span>
                                            <span>{client.department}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">🔍</div>
                                <p>
                                    {clients.length === 0
                                        ? "No clients registered yet. Add your first client!"
                                        : "No clients match your search."
                                    }
                                </p>
                                {clients.length > 0 && (
                                    <button onClick={() => { handleSearch(""); handleStatus("All Statuses"); }}>
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── PAGINATION ── */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <span
                                    className={page === 1 ? "disabled" : ""}
                                    onClick={() => page > 1 && setPage(page - 1)}
                                >{"<"}</span>

                                {pageNumbers().map((p, i) =>
                                    p === "..." ? (
                                        <span key={`ellipsis-${i}`} className="ellipsis">...</span>
                                    ) : (
                                        <span
                                            key={p}
                                            className={page === p ? "active" : ""}
                                            onClick={() => setPage(p)}
                                        >{p}</span>
                                    )
                                )}

                                <span
                                    className={page === totalPages ? "disabled" : ""}
                                    onClick={() => page < totalPages && setPage(page + 1)}
                                >{">"}</span>
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};

export default Dashboard;