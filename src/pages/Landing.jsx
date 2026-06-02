import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Services", href: "#services" },
  { label: "Loan Products", href: "#loan-products" },
  { label: "About Us", href: "#about" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Contact", href: "#contact" },
];

const LOAN_PRODUCTS = [
  {
    title: "Personal Loan",
    desc: "Quick personal loans for emergencies and personal needs. Fast approval, minimal paperwork.",
    rate: "From 10%",
    term: "Up to 12 months",
  },
  {
    title: "Business Loan",
    desc: "Grow your business with tailored financing. Flexible repayment schedules for entrepreneurs.",
    rate: "From 12%",
    term: "Up to 24 months",
  },
  {
    title: "Emergency Loan",
    desc: "Instant disbursement for urgent needs. Apply, get approved, and receive funds within hours.",
    rate: "From 8%",
    term: "Up to 3 months",
  },
  {
    title: "Group Loan",
    desc: "Community-based lending for cooperative groups and chamas. Collective repayment support.",
    rate: "From 7%",
    term: "Up to 18 months",
  },
];

const SERVICES = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-8 h-8"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707"
        />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    title: "Instant Disbursement",
    desc: "Approved loans are disbursed directly to your M-Pesa or bank account within minutes via our B2C Paybill integration.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-8 h-8"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: "Secure Transactions",
    desc: "All payments are encrypted and secured. M-Pesa PIN and bank PIN authentication ensure only you authorise transfers.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-8 h-8"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "Flexible Repayment",
    desc: "Choose daily, weekly, or monthly repayment plans. Automated deductions on your preferred schedule — no manual effort.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-8 h-8"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    title: "Real-Time Reporting",
    desc: "Admins, managers, and employees get live dashboards showing loan status, payments, disbursements, and audit trails.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-8 h-8"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
        />
      </svg>
    ),
    title: "Multi-Role Access",
    desc: "Separate portals for Admin, Manager, Employee, and Customer — each with granular permissions configured by the Admin.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-8 h-8"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "M-Pesa & Bank Integration",
    desc: "Full Safaricom M-Pesa API and bank transfer integration for both disbursements and collections seamlessly.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Register",
    desc: "Create your account as a Customer, Employee, Manager, or Admin. Verification is fast and simple.",
  },
  {
    num: "02",
    title: "Apply for a Loan",
    desc: "Fill in your loan application with the amount and purpose. Submit and await approval from our team.",
  },
  {
    num: "03",
    title: "Get Approved",
    desc: "The manager reviews your application. Upon approval, the system initiates disbursement automatically.",
  },
  {
    num: "04",
    title: "Receive Funds",
    desc: "Funds are sent directly to your M-Pesa or bank account via B2C Paybill. No delays, no queues.",
  },
  {
    num: "05",
    title: "Repay with Ease",
    desc: "Choose your repayment schedule. The system deducts automatically on your due date — just confirm your PIN.",
  },
];

const TESTIMONIALS = [
  {
    name: "Amara Njoroge",
    role: "Small Business Owner",
    quote:
      "Felix processed my business loan within the same day. The M-Pesa disbursement was instant. I've never experienced anything like it.",
  },
  {
    name: "David Ochieng",
    role: "Freelance Developer",
    quote:
      "The automated daily repayment feature is a game changer. No more worrying about missing payments — Felix handles everything.",
  },
  {
    name: "Grace Wambui",
    role: "Market Vendor",
    quote:
      "As someone who runs a market stall, the emergency loan feature literally saved my business during a slow month. Highly recommend Felix.",
  },
];

const ROLES = [
  {
    label: "Admin",
    path: "/register/admin",
    color: "from-amber-500 to-orange-500",
    icon: "A",
  },
  {
    label: "Manager",
    path: "/register/manager",
    color: "from-green-500 to-emerald-600",
    icon: "M",
  },
  {
    label: "Employer",
    path: "/register/employer",
    color: "from-sky-500 to-blue-600",
    icon: "E",
  },
  {
    label: "Customer",
    path: "/register/customer",
    color: "from-violet-500 to-purple-600",
    icon: "C",
  },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerRole, setRegisterRole] = useState("customer");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openRegister = (role = "customer") => {
    setRegisterRole(role);
    setRegisterOpen(true);
    setRegisterError("");
  };

  const closeRegister = () => {
    setRegisterOpen(false);
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterSuccess("");
    if (!registerUsername || !registerPassword) {
      setRegisterError("Please fill in both username and password.");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }
    setRegisterLoading(true);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerUsername,
          email: registerEmail,
          password: registerPassword,
          role: registerRole,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Registration failed");
      }
      if (data.pendingApproval) {
        setRegisterSuccess(
          "Your manager/employer account has been submitted and is pending admin approval.",
        );
      } else {
        await login({ username: registerUsername, password: registerPassword });
      }
    } catch (err) {
      setRegisterError(err.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    const t = setInterval(
      () => setActiveTestimonial((p) => (p + 1) % TESTIMONIALS.length),
      4000,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#0a0c10] text-white overflow-x-hidden"
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .felix-display { font-family: 'Playfair Display', Georgia, serif; }
        .felix-body { font-family: 'DM Sans', system-ui, sans-serif; }
        .gold-accent { color: #f5a623; }
        .gold-bg { background-color: #f5a623; }
        .gold-border { border-color: #f5a623; }
        .nav-link {
          position: relative;
          transition: color 0.2s;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: #f5a623;
          transition: width 0.3s ease;
        }
        .nav-link:hover::after { width: 100%; }
        .nav-link:hover { color: #f5a623; }
        .hero-grid {
          background-image:
            linear-gradient(rgba(245,166,35,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,166,35,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 60px rgba(245,166,35,0.15);
          border-color: rgba(245,166,35,0.4);
        }
        .step-line::after {
          content: '';
          position: absolute;
          top: 28px;
          left: calc(100% + 1px);
          width: calc(100% - 2px);
          height: 1px;
          background: linear-gradient(90deg, #f5a623, transparent);
        }
        .animate-fade-up {
          animation: fadeUp 0.8s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-delay-1 { animation-delay: 0.1s; }
        .animate-delay-2 { animation-delay: 0.2s; }
        .animate-delay-3 { animation-delay: 0.35s; }
        .animate-delay-4 { animation-delay: 0.5s; }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .hero-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.12;
          animation: float 8s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        .stat-counter {
          font-variant-numeric: tabular-nums;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #f5a623 !important;
          box-shadow: 0 0 0 3px rgba(245,166,35,0.12);
        }
        .role-card {
          transition: all 0.3s ease;
        }
        .role-card:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(245,166,35,0.2);
        }
        .testimonial-card {
          transition: all 0.5s ease;
        }
        .mobile-menu {
          animation: slideDown 0.3s ease both;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .section-tag {
          display: inline-block;
          padding: 4px 14px;
          border: 1px solid rgba(245,166,35,0.3);
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #f5a623;
          margin-bottom: 16px;
          font-family: 'DM Sans', sans-serif;
        }
        .divider-gold {
          display: block;
          width: 48px;
          height: 3px;
          background: #f5a623;
          margin: 16px 0 24px;
          border-radius: 2px;
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0a0c10]/95 backdrop-blur-md shadow-xl shadow-black/40 py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 gold-bg rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <span className="felix-display font-black text-[#0a0c10] text-lg leading-none">
                F
              </span>
            </div>
            <div>
              <span className="felix-display font-bold text-white text-xl tracking-tight">
                Felix
              </span>
              <span className="felix-body text-[10px] text-gray-400 block leading-none tracking-widest uppercase">
                Microfinance
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="nav-link felix-body text-sm text-gray-300 font-medium"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className="felix-body text-sm text-gray-300 border border-gray-600 hover:border-amber-400 hover:text-amber-400 px-5 py-2 rounded-lg transition-all duration-200"
            >
              Login
            </Link>
            <button
              type="button"
              onClick={() => openRegister("customer")}
              className="felix-body text-sm font-semibold gold-bg text-[#0a0c10] px-5 py-2 rounded-lg hover:brightness-110 transition-all duration-200 shadow-lg shadow-amber-900/30"
            >
              Get Started
            </button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden p-2 text-gray-300 hover:text-amber-400"
            onClick={() => setMobileOpen((p) => !p)}
          >
            {mobileOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="mobile-menu lg:hidden bg-[#0f1117] border-t border-gray-800 mt-3 px-6 py-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="felix-body block text-gray-300 py-3 border-b border-gray-800/50 hover:text-amber-400 transition-colors text-sm"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-3 mt-4">
              <Link
                to="/login"
                className="flex-1 text-center felix-body text-sm border border-gray-600 text-gray-300 py-2 rounded-lg"
              >
                Login
              </Link>
              <button
                type="button"
                onClick={() => openRegister("customer")}
                className="flex-1 text-center felix-body text-sm gold-bg text-[#0a0c10] font-semibold py-2 rounded-lg"
              >
                Register
              </button>
            </div>
          </div>
        )}
      </nav>

      {registerOpen && (
        <div className="fixed inset-x-0 top-[72px] z-40 px-4 lg:px-6">
          <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Register on Felix
                </h2>
                <p className="text-slate-400 text-sm">
                  Create your account directly from the landing page.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRegister}
                className="self-start rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900/80"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={submitRegister}
              className="grid gap-4 lg:grid-cols-2"
            >
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-300">
                  Select Role
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none"
                  >
                    {ROLES.map((option) => (
                      <option
                        key={option.label}
                        value={option.value || option.label.toLowerCase()}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {(registerRole === "manager" ||
                    registerRole === "employer") && (
                    <p className="mt-2 text-xs text-amber-200">
                      Manager and Employer accounts require admin approval
                      before login.
                    </p>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-300">
                  Username
                  <input
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none"
                    placeholder="Choose a username"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-300">
                  Email (optional)
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-300">
                  Password
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none"
                    placeholder="Enter a strong password"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-300">
                  Confirm Password
                  <input
                    type="password"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100 focus:border-amber-400 focus:outline-none"
                    placeholder="Repeat your password"
                  />
                </label>

                <button
                  type="submit"
                  disabled={registerLoading}
                  className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {registerLoading
                    ? "Registering..."
                    : `Register as ${registerRole}`}
                </button>
              </div>
            </form>

            {registerSuccess && (
              <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-100">
                {registerSuccess}
              </div>
            )}
            {registerError && (
              <div className="mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200">
                {registerError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="hero-grid relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Blobs */}
        <div className="hero-blob w-96 h-96 bg-amber-500 top-20 -left-20" />
        <div
          className="hero-blob w-80 h-80 bg-amber-600 bottom-20 right-10"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="hero-blob w-60 h-60 bg-orange-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ animationDelay: "1.5s" }}
        />

        {/* Noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="section-tag animate-fade-up">
              Microfinance Reimagined
            </div>
            <h1 className="felix-display text-6xl md:text-7xl lg:text-8xl font-black leading-none text-white animate-fade-up animate-delay-1">
              Smart
              <br />
              <span className="gold-accent">Financial</span>
              <br />
              Access
            </h1>
            <span className="divider-gold animate-fade-up animate-delay-2" />
            <p className="felix-body text-gray-400 text-lg leading-relaxed max-w-md animate-fade-up animate-delay-2">
              Felix Microfinance delivers instant loans, automated repayments,
              and real-time portfolio management — all powered by M-Pesa and
              bank integrations.
            </p>

            <div className="flex flex-wrap gap-4 mt-8 animate-fade-up animate-delay-3">
              <button
                type="button"
                onClick={() => openRegister("customer")}
                className="felix-body font-semibold gold-bg text-[#0a0c10] px-8 py-3.5 rounded-xl hover:brightness-110 transition-all shadow-xl shadow-amber-900/40 text-base"
              >
                Apply for a Loan
              </button>
              <a
                href="#how-it-works"
                className="felix-body text-white border border-gray-600 hover:border-amber-400 hover:text-amber-400 px-8 py-3.5 rounded-xl transition-all text-base"
              >
                How It Works
              </a>
            </div>

            {/* Stats Row */}
            <div className="flex gap-8 mt-12 animate-fade-up animate-delay-4">
              {[
                { val: "5,000+", label: "Active Clients" },
                { val: "KES 50M+", label: "Disbursed" },
                { val: "99.2%", label: "Repayment Rate" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="felix-display text-2xl font-bold gold-accent stat-counter">
                    {s.val}
                  </div>
                  <div className="felix-body text-xs text-gray-500 mt-0.5 tracking-wide">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Register Card */}
          <div className="animate-fade-up animate-delay-3">
            <div className="bg-[#0f1117]/80 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-8 shadow-2xl">
              <h3 className="felix-display text-2xl font-bold text-white mb-2">
                Get Started Today
              </h3>
              <p className="felix-body text-gray-400 text-sm mb-6">
                Register as your role to access your personalized portal.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {ROLES.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() =>
                      openRegister(r.value || r.label.toLowerCase())
                    }
                    className={`role-card flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br ${r.color} bg-opacity-10 border border-white/10 hover:border-white/20 text-left`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center text-white font-bold text-sm felix-display flex-shrink-0`}
                    >
                      {r.icon}
                    </div>
                    <div>
                      <div className="felix-body font-semibold text-white text-sm">
                        {r.label}
                      </div>
                      <div className="felix-body text-gray-400 text-xs">
                        Register
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-800 pt-5">
                <p className="felix-body text-gray-500 text-xs text-center mb-3">
                  Already have an account?
                </p>
                <Link
                  to="/login"
                  className="felix-body w-full block text-center border border-gray-700 hover:border-amber-400 text-gray-300 hover:text-amber-400 py-3 rounded-xl transition-all text-sm font-medium"
                >
                  Sign In to Your Portal
                </Link>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-4 mt-4 px-2">
              {["M-Pesa Integrated", "Bank API Ready", "256-bit SSL"].map(
                (b) => (
                  <div key={b} className="flex items-center gap-1.5">
                    <svg
                      className="w-3 h-3 text-amber-400 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="felix-body text-gray-500 text-xs">
                      {b}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="felix-body text-gray-600 text-xs tracking-widest uppercase">
            Scroll
          </span>
          <svg
            className="w-4 h-4 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="how-it-works"
        className="py-28 bg-[#0d0f14] relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="section-tag">Process</div>
            <h2 className="felix-display text-4xl md:text-5xl font-black text-white">
              How Felix Works
            </h2>
            <span className="divider-gold mx-auto block" />
            <p className="felix-body text-gray-400 max-w-xl mx-auto">
              From application to disbursement, Felix streamlines every step of
              the microfinance journey.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-0 relative">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="relative flex flex-col items-center text-center px-4 group"
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(50%+28px)] right-0 h-px bg-gradient-to-r from-amber-500/40 to-transparent" />
                )}
                {/* Number circle */}
                <div className="w-14 h-14 rounded-full border-2 border-amber-500/40 group-hover:border-amber-400 bg-[#0a0c10] flex items-center justify-center mb-4 transition-all group-hover:shadow-lg group-hover:shadow-amber-500/20 relative z-10">
                  <span className="felix-display font-black text-amber-500 text-lg">
                    {step.num}
                  </span>
                </div>
                <h4 className="felix-display font-bold text-white text-base mb-2 group-hover:text-amber-400 transition-colors">
                  {step.title}
                </h4>
                <p className="felix-body text-gray-500 text-xs leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-28 bg-[#0a0c10] relative">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, #f5a623 0%, transparent 50%), radial-gradient(circle at 80% 50%, #f5a623 0%, transparent 50%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="mb-16">
            <div className="section-tag">What We Offer</div>
            <h2 className="felix-display text-4xl md:text-5xl font-black text-white">
              Core Platform Services
            </h2>
            <span className="divider-gold" />
            <p className="felix-body text-gray-400 max-w-2xl">
              Felix combines powerful financial tools with mobile money
              infrastructure to deliver a complete microfinance ecosystem.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((s) => (
              <div
                key={s.title}
                className="card-hover group bg-[#0f1117] border border-gray-800/60 rounded-2xl p-7 cursor-default"
              >
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 mb-5 group-hover:bg-amber-500/20 transition-colors">
                  {s.icon}
                </div>
                <h4 className="felix-display font-bold text-white text-lg mb-2">
                  {s.title}
                </h4>
                <p className="felix-body text-gray-400 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOAN PRODUCTS ── */}
      <section id="loan-products" className="py-28 bg-[#0d0f14]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="section-tag">Loan Products</div>
            <h2 className="felix-display text-4xl md:text-5xl font-black text-white">
              Tailored Financing Solutions
            </h2>
            <span className="divider-gold mx-auto block" />
            <p className="felix-body text-gray-400 max-w-xl mx-auto">
              Every borrower is unique. Felix offers diverse loan products
              designed for different needs and repayment capacities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {LOAN_PRODUCTS.map((lp, i) => (
              <div
                key={lp.title}
                className="card-hover group relative bg-[#0f1117] border border-gray-800/60 rounded-2xl p-6 overflow-hidden"
              >
                {i === 0 && (
                  <div className="absolute top-4 right-4 gold-bg text-[#0a0c10] text-[9px] font-bold px-2 py-0.5 rounded-full felix-body tracking-wide uppercase">
                    Popular
                  </div>
                )}
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mb-4 text-[#0a0c10] font-bold text-sm felix-display">
                  {lp.title.charAt(0)}
                </div>
                <h4 className="felix-display font-bold text-white text-lg mb-2">
                  {lp.title}
                </h4>
                <p className="felix-body text-gray-500 text-xs leading-relaxed mb-5">
                  {lp.desc}
                </p>
                <div className="border-t border-gray-800 pt-4 flex justify-between">
                  <div>
                    <div className="felix-body text-[10px] text-gray-600 uppercase tracking-wide">
                      Rate
                    </div>
                    <div className="felix-display font-bold gold-accent text-sm">
                      {lp.rate}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="felix-body text-[10px] text-gray-600 uppercase tracking-wide">
                      Term
                    </div>
                    <div className="felix-display font-bold text-gray-300 text-sm">
                      {lp.term}
                    </div>
                  </div>
                </div>
                <Link
                  to="/register/customer"
                  className="felix-body mt-4 block text-center text-xs font-semibold border border-amber-500/30 text-amber-400 hover:gold-bg hover:bg-amber-500 hover:text-[#0a0c10] py-2.5 rounded-xl transition-all"
                >
                  Apply Now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REPAYMENT CALC SECTION ── */}
      <section className="py-24 bg-gradient-to-br from-amber-500/10 via-[#0a0c10] to-orange-900/10 border-y border-gray-800/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="section-tag">Transparent Pricing</div>
              <h2 className="felix-display text-4xl font-black text-white mb-4">
                Know What You Pay — Before You Borrow
              </h2>
              <span className="divider-gold" />
              <p className="felix-body text-gray-400 leading-relaxed mb-6">
                Felix operates on full transparency. Your repayment amount is
                calculated upfront based on the borrowed amount, term, and the
                admin-configured deduction rate. No hidden fees.
              </p>
              <div className="bg-[#0f1117] border border-gray-800 rounded-2xl p-6">
                <h4 className="felix-body font-semibold text-gray-300 text-sm mb-4 uppercase tracking-wide">
                  Example Calculation
                </h4>
                <div className="space-y-3">
                  {[
                    ["Borrowed Amount", "KES 2,000"],
                    ["Loan Term", "20 Days"],
                    ["Daily Principal", "KES 100"],
                    ["Deduction Rate", "10%"],
                    ["Daily Deduction", "KES 10"],
                    ["Daily Payment", "KES 110"],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center border-b border-gray-800/50 pb-2"
                    >
                      <span className="felix-body text-gray-500 text-sm">
                        {label}
                      </span>
                      <span className="felix-body font-semibold text-gray-200 text-sm">
                        {val}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="felix-display font-bold text-white">
                      Total Repayment
                    </span>
                    <span className="felix-display font-black gold-accent text-xl">
                      KES 2,200
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: "Daily Repayment",
                  desc: "Automated daily deductions on your schedule.",
                  icon: "D",
                },
                {
                  label: "Weekly Repayment",
                  desc: "Once a week deduction, every 7 days.",
                  icon: "W",
                },
                {
                  label: "Monthly Repayment",
                  desc: "Single monthly deduction, full control.",
                  icon: "M",
                },
                {
                  label: "One-Time Payment",
                  desc: "Pay the full amount at your convenience.",
                  icon: "1",
                },
              ].map((opt) => (
                <div
                  key={opt.label}
                  className="card-hover bg-[#0f1117] border border-gray-800 rounded-2xl p-5 text-center"
                >
                  <div className="w-12 h-12 gold-bg rounded-full flex items-center justify-center text-[#0a0c10] font-black felix-display text-lg mx-auto mb-3">
                    {opt.icon}
                  </div>
                  <h5 className="felix-display font-bold text-white text-sm mb-1">
                    {opt.label}
                  </h5>
                  <p className="felix-body text-gray-500 text-xs">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="py-28 bg-[#0a0c10]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="section-tag mx-auto">Client Stories</div>
          <h2 className="felix-display text-4xl md:text-5xl font-black text-white mb-4">
            Trusted by Thousands
          </h2>
          <span className="divider-gold mx-auto block" />

          <div className="relative mt-12">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={`testimonial-card ${i === activeTestimonial ? "opacity-100 translate-y-0" : "opacity-0 absolute inset-0 translate-y-4 pointer-events-none"}`}
              >
                <div className="bg-[#0f1117] border border-gray-800/60 rounded-3xl p-10 shadow-2xl">
                  <div className="text-amber-400 text-5xl felix-display leading-none mb-4 opacity-50">
                    "
                  </div>
                  <p className="felix-body text-gray-300 text-lg leading-relaxed italic mb-8">
                    {t.quote}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 gold-bg rounded-full flex items-center justify-center text-[#0a0c10] font-black felix-display text-lg">
                      {t.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="felix-display font-bold text-white">
                        {t.name}
                      </div>
                      <div className="felix-body text-gray-500 text-sm">
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeTestimonial ? "w-8 gold-bg" : "w-2 bg-gray-700"}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-28 bg-[#0d0f14]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="section-tag">About Felix</div>
              <h2 className="felix-display text-4xl md:text-5xl font-black text-white">
                Built for the Modern Borrower
              </h2>
              <span className="divider-gold" />
              <p className="felix-body text-gray-400 leading-relaxed mb-6">
                Felix Microfinance was built to bridge the gap between formal
                financial institutions and the everyday borrower. By leveraging
                mobile money infrastructure, we ensure that financial inclusion
                is not just a concept — it is a lived reality.
              </p>
              <p className="felix-body text-gray-400 leading-relaxed mb-8">
                Our platform empowers administrators with full control, gives
                managers clear oversight tools, equips employees with efficient
                workflow management, and puts customers at the center of every
                decision.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { val: "4", label: "User Role Portals" },
                  { val: "24/7", label: "Automated Operations" },
                  { val: "2min", label: "Avg. Approval Time" },
                  { val: "100%", label: "Mobile Money Ready" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-[#0f1117] border border-gray-800 rounded-xl p-4"
                  >
                    <div className="felix-display text-2xl font-black gold-accent">
                      {s.val}
                    </div>
                    <div className="felix-body text-gray-500 text-xs mt-0.5">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-900/20 rounded-3xl p-8 border border-amber-500/10">
                <div className="space-y-4">
                  {[
                    {
                      role: "Admin",
                      desc: "Full system control, user management, and global settings.",
                    },
                    {
                      role: "Manager",
                      desc: "Loan approvals, team oversight, and financial reporting.",
                    },
                    {
                      role: "Employee",
                      desc: "Application processing, client management, and tracking.",
                    },
                    {
                      role: "Customer",
                      desc: "Loan applications, repayments, and account management.",
                    },
                  ].map((r, i) => (
                    <div key={r.role} className="flex gap-4 items-start">
                      <div
                        className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[#0a0c10] font-black text-xs felix-display bg-gradient-to-br ${
                          ROLES[i].color
                        }`}
                      >
                        {r.role.charAt(0)}
                      </div>
                      <div>
                        <div className="felix-display font-bold text-white text-sm">
                          {r.role} Portal
                        </div>
                        <div className="felix-body text-gray-500 text-xs mt-0.5">
                          {r.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-28 bg-[#0a0c10]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="section-tag mx-auto">Get In Touch</div>
            <h2 className="felix-display text-4xl md:text-5xl font-black text-white">
              Start Your Felix Journey
            </h2>
            <span className="divider-gold mx-auto block" />
            <p className="felix-body text-gray-400 max-w-xl mx-auto">
              Have questions or need assistance setting up your account? Our
              team is ready to help you get started.
            </p>
          </div>

          <div className="bg-[#0f1117] border border-gray-800/60 rounded-3xl p-10 shadow-2xl">
            <div className="grid md:grid-cols-2 gap-5">
              {[
                {
                  id: "name",
                  label: "Full Name",
                  type: "text",
                  placeholder: "John Kamau",
                },
                {
                  id: "email",
                  label: "Email Address",
                  type: "email",
                  placeholder: "john@example.com",
                },
                {
                  id: "phone",
                  label: "Phone Number",
                  type: "tel",
                  placeholder: "+254 7XX XXX XXX",
                },
              ].map((field) => (
                <div
                  key={field.id}
                  className={field.id === "phone" ? "md:col-span-2" : ""}
                >
                  <label className="felix-body text-gray-400 text-xs uppercase tracking-widest block mb-2">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.id] || ""}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, [field.id]: e.target.value }))
                    }
                    className="w-full bg-[#0a0c10] border border-gray-700 rounded-xl px-4 py-3 text-white felix-body text-sm placeholder-gray-600 transition-all"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="felix-body text-gray-400 text-xs uppercase tracking-widest block mb-2">
                  Message
                </label>
                <textarea
                  rows={4}
                  placeholder="Tell us about your needs..."
                  value={formData.message}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, message: e.target.value }))
                  }
                  className="w-full bg-[#0a0c10] border border-gray-700 rounded-xl px-4 py-3 text-white felix-body text-sm placeholder-gray-600 resize-none transition-all"
                />
              </div>
            </div>
            <button className="felix-body mt-6 w-full gold-bg text-[#0a0c10] font-bold py-4 rounded-xl hover:brightness-110 transition-all text-base shadow-xl shadow-amber-900/30">
              Send Message
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#070810] border-t border-gray-800/50 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 gold-bg rounded-lg flex items-center justify-center">
                  <span className="felix-display font-black text-[#0a0c10] text-lg">
                    F
                  </span>
                </div>
                <div>
                  <span className="felix-display font-bold text-white text-xl">
                    Felix
                  </span>
                  <span className="felix-body text-[10px] text-gray-500 block tracking-widest uppercase">
                    Microfinance
                  </span>
                </div>
              </div>
              <p className="felix-body text-gray-500 text-sm leading-relaxed">
                Modern microfinance infrastructure powered by mobile money
                integration and intelligent automation.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h5 className="felix-display font-bold text-white mb-4 text-sm">
                Platform
              </h5>
              <ul className="space-y-2">
                {[
                  "How It Works",
                  "Loan Products",
                  "Services",
                  "Repayment Plans",
                  "M-Pesa Integration",
                ].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="felix-body text-gray-500 text-sm hover:text-amber-400 transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Portals */}
            <div>
              <h5 className="felix-display font-bold text-white mb-4 text-sm">
                Portals
              </h5>
              <ul className="space-y-2">
                {[
                  { label: "Admin Dashboard", path: "/admin" },
                  { label: "Manager Portal", path: "/manager" },
                  { label: "Employee Portal", path: "/employee" },
                  { label: "Customer Portal", path: "/customer" },
                  { label: "Register", path: "/register" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.path}
                      className="felix-body text-gray-500 text-sm hover:text-amber-400 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h5 className="felix-display font-bold text-white mb-4 text-sm">
                Contact
              </h5>
              <ul className="space-y-3">
                {[
                  { icon: "L", label: "Nairobi, Kenya" },
                  { icon: "P", label: "+254 700 000 000" },
                  { icon: "E", label: "info@felixmfi.co.ke" },
                ].map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded gold-bg flex items-center justify-center text-[#0a0c10] text-[8px] font-bold felix-display flex-shrink-0">
                      {c.icon}
                    </div>
                    <span className="felix-body text-gray-500 text-sm">
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <h6 className="felix-body text-gray-600 text-xs uppercase tracking-widest mb-3">
                  Accepted Payments
                </h6>
                <div className="flex gap-2">
                  {["M-Pesa", "Bank"].map((p) => (
                    <div
                      key={p}
                      className="border border-gray-700 rounded-lg px-3 py-1.5 felix-body text-gray-400 text-xs"
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="felix-body text-gray-600 text-xs">
              {new Date().getFullYear()} Felix Microfinance. All rights
              reserved.
            </p>
            <div className="flex gap-6">
              {["Privacy Policy", "Terms of Service", "Sitemap"].map((l) => (
                <a
                  key={l}
                  href="#"
                  className="felix-body text-gray-600 text-xs hover:text-amber-400 transition-colors"
                >
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
