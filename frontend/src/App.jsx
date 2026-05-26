import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import robotPeek from "./robot-peek.png";
import robotStanding from "./robot-standing.png";

/* ─── PALETTE & TOKENS ─────────────────────────────────────────────────────── */
const C = {
  bg:       "#F8FAFC",
  panel:    "rgba(255,255,255,0.92)",
  border:   "rgba(15,23,42,0.08)",
  accent1:  "#0EA5E9",   // sky blue
  accent2:  "#6366F1",   // indigo
  accent3:  "#10B981",   // emerald
  warn:     "#F59E0B",
  danger:   "#EF4444",
  text:     "#0F172A",
  muted:    "#64748B",
  dimmed:   "#E2E8F0",
};

/* ─── GLOBAL STYLES ────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'Syne', sans-serif; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.dimmed}; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 2px; }
  ::selection { background: ${C.accent1}33; }
  input, select, textarea {
    font-family: 'JetBrains Mono', monospace;
    background: #FFFFFF;
    border: 1px solid ${C.border};
    color: ${C.text};
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    outline: none;
    width: 100%;
    transition: border-color .2s, box-shadow .2s;
  }
  input:focus, select:focus {
    border-color: ${C.accent1}88;
    box-shadow: 0 0 0 3px ${C.accent1}18;
  }
  input::placeholder { color: #94A3B8; }
  select option { background: #fff; color: ${C.text}; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse   { 0%,100%{ opacity:1; } 50%{ opacity:.4; } }
  @keyframes glow    { 0%,100%{ text-shadow:0 0 8px ${C.accent1}40; } 50%{ text-shadow:0 0 20px ${C.accent1}66, 0 0 40px ${C.accent1}22; } }
  @keyframes borderPulse { 0%,100%{ border-color:${C.accent1}18; } 50%{ border-color:${C.accent1}44; } }
  @keyframes float   { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
  @keyframes robotFloat { 0%,100%{ transform:translateY(0) scale(1); } 50%{ transform:translateY(-10px) scale(1.005); } }
  .fade-up  { animation: fadeUp .45s cubic-bezier(.16,1,.3,1) both; }
  .glow-text{ animation: glow 3s ease-in-out infinite; }
`;

/* ─── THREE.JS CANVAS BACKGROUND ───────────────────────────────────────────── */
function ParticleField() {
  const mountRef = useRef(null);
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.set(0, 0, 80);

    // Particles
    const N = 1800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const colors = [
      new THREE.Color(C.accent1),
      new THREE.Color(C.accent2),
      new THREE.Color(C.accent3),
    ];
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - .5) * 200;
      pos[i*3+1] = (Math.random() - .5) * 200;
      pos[i*3+2] = (Math.random() - .5) * 200;
      const c = colors[Math.floor(Math.random() * colors.length)];
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: .55, vertexColors: true, transparent: true, opacity: .7 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Torus knot
    const tGeo = new THREE.TorusKnotGeometry(18, 3.5, 180, 20);
    const tMat = new THREE.MeshBasicMaterial({ color: C.accent1, wireframe: true, transparent: true, opacity: .06 });
    const torus = new THREE.Mesh(tGeo, tMat);
    torus.position.set(60, -20, -40);
    scene.add(torus);

    // Grid
    const grid = new THREE.GridHelper(300, 40, C.accent1, C.accent1);
    grid.material.transparent = true; grid.material.opacity = .04;
    grid.position.y = -60;
    scene.add(grid);

    let mouse = { x: 0, y: 0 };
    const onMouse = e => { mouse.x = (e.clientX / W - .5) * 2; mouse.y = -(e.clientY / H - .5) * 2; };
    window.addEventListener("mousemove", onMouse);

    let t = 0;
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      t += .004;
      points.rotation.y = t * .12;
      points.rotation.x = t * .05;
      torus.rotation.x = t * .3;
      torus.rotation.z = t * .2;
      camera.position.x += (mouse.x * 12 - camera.position.x) * .02;
      camera.position.y += (mouse.y * 8  - camera.position.y) * .02;
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nW = el.clientWidth, nH = el.clientHeight;
      camera.aspect = nW / nH; camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);
  return (
    <div ref={mountRef} style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    }} />
  );
}

/* ─── SCANLINE OVERLAY ─────────────────────────────────────────────────────── */
function Scanline() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", left: 0, right: 0, height: "2px",
        background: `linear-gradient(to bottom, transparent, ${C.accent1}08, transparent)`,
        animation: "scanline 8s linear infinite",
      }} />
      {/* vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(3,7,15,.7) 100%)",
      }} />
    </div>
  );
}

/* ─── API ───────────────────────────────────────────────────────────────────── */
const BASE = "http://localhost:8080";
const api = {
  async post(path, body, token, isJson = false) {
    const headers = { ...(token && { Authorization: `Bearer ${token}` }) };
    let init;
    if (isJson) {
      headers["Content-Type"] = "application/json";
      init = { method: "POST", headers, body: JSON.stringify(body) };
    } else {
      init = { method: "POST", headers, body: new URLSearchParams(body) };
    }
    const r = await fetch(`${BASE}${path}`, init);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const ct = r.headers.get("content-type") || "";
    return ct.includes("json") ? r.json() : r.text();
  },
  async get(path, token) {
    const r = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  },
  async put(path, body, token) {
    const r = await fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  },
  async del(path, token) {
    const r = await fetch(`${BASE}${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  },
};

/* ─── MICRO COMPONENTS ──────────────────────────────────────────────────────── */
const ALGO_COLORS = { SLIDING_WINDOW: C.accent2, TOKEN_BUCKET: C.accent3, FIXED_WINDOW: C.warn };
const STATUS_COLORS = { SUCCESS: C.accent3, FAILED: C.danger, PENDING: C.warn, REFUNDED: C.muted, ACTIVE: C.accent3, INACTIVE: C.danger };

function Chip({ v }) {
  const color = ALGO_COLORS[v] || STATUS_COLORS[v] || C.accent1;
  return (
    <span style={{
      background: color + "18", color, border: `1px solid ${color}44`,
      borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 600,
      letterSpacing: ".06em", fontFamily: "'JetBrains Mono', monospace",
      textTransform: "uppercase",
    }}>{v}</span>
  );
}

function GlassCard({ children, style = {}, delay = 0 }) {
  return (
    <div className="fade-up" style={{
      background: "#FFFFFF",
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      padding: 24,
      boxShadow: "0 1px 3px rgba(15,23,42,.06), 0 4px 24px rgba(15,23,42,.04)",
      animation: `fadeUp .5s ${delay}s cubic-bezier(.16,1,.3,1) both, borderPulse 4s ${delay}s ease-in-out infinite`,
      ...style,
    }}>{children}</div>
  );
}

function StatCard({ label, value, sub, accent, delay, icon }) {
  return (
    <GlassCard delay={delay} style={{ flex: 1, minWidth: 140, position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: -20, right: -20, fontSize: 64, opacity: .04,
        fontFamily: "'JetBrains Mono', monospace",
      }}>{icon}</div>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{
        fontSize: 36, fontWeight: 800, color: accent || C.text,
        fontFamily: "'JetBrains Mono', monospace",
        textShadow: `0 0 20px ${accent || C.accent1}60`,
      }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent || C.accent1}66, transparent)`,
      }} />
    </GlassCard>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style = {} }) {
  const styles = {
    primary: { background: `linear-gradient(135deg, ${C.accent1}22, ${C.accent2}22)`, color: C.accent1, border: `1px solid ${C.accent1}55` },
    success: { background: `linear-gradient(135deg, ${C.accent3}22, ${C.accent3}11)`, color: C.accent3, border: `1px solid ${C.accent3}55` },
    danger:  { background: `linear-gradient(135deg, ${C.danger}22, ${C.danger}11)`, color: C.danger, border: `1px solid ${C.danger}44` },
    ghost:   { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    glow:    { background: `linear-gradient(135deg, ${C.accent1}, ${C.accent2})`, color: "#fff", border: "none", boxShadow: `0 0 24px ${C.accent1}55` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      borderRadius: 10, padding: "10px 20px", fontSize: 12, fontWeight: 600,
      fontFamily: "'JetBrains Mono', monospace", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? .4 : 1, letterSpacing: ".04em",
      transition: "all .2s", whiteSpace: "nowrap",
      ...style,
    }}
    onMouseEnter={e => !disabled && (e.currentTarget.style.filter = "brightness(1.2)")}
    onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
    >{children}</button>
  );
}

function Toast({ msg, ok }) {
  if (!msg) return null;
  return (
    <div className="fade-up" style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: ok ? "rgba(6,78,59,.9)" : "rgba(69,10,10,.9)",
      border: `1px solid ${ok ? C.accent3 : C.danger}66`,
      color: ok ? C.accent3 : C.danger,
      borderRadius: 12, padding: "14px 20px", fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      backdropFilter: "blur(20px)",
      boxShadow: `0 8px 32px ${ok ? C.accent3 : C.danger}33`,
      maxWidth: 380,
    }}>{ok ? "✓ " : "✗ "}{msg}</div>
  );
}

function Spinner() {
  return <span style={{
    display: "inline-block", width: 14, height: 14,
    border: `2px solid ${C.dimmed}`, borderTop: `2px solid ${C.accent1}`,
    borderRadius: "50%", animation: "spin .6s linear infinite",
  }} />;
}

function FieldLabel({ children }) {
  return <div style={{ color: C.muted, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><FieldLabel>{label}</FieldLabel>{children}</div>;
}

function SectionTitle({ children, accent = C.accent1 }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 3, height: 20, background: `linear-gradient(to bottom, ${accent}, transparent)`, borderRadius: 2 }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: "-.02em" }}>{children}</h2>
      </div>
    </div>
  );
}

/* ─── ANIMATED COUNTER ──────────────────────────────────────────────────────── */
function CountUp({ to }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(to / 30);
    const timer = setInterval(() => {
      start = Math.min(start + step, to);
      setVal(start);
      if (start >= to) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [to]);
  return <>{val}</>;
}


/* ─── LOGIN ──────────────────────────────────────────────────────────────────── */
const ROBOT_URL = robotStanding;

function Login({ onLogin }) {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setLoading(true); setErr("");
    try {
      const data = await api.post("/api/auth/login", { username: u, password: p });
      onLogin(data.token, data.username);
    } catch (ex) {
      setErr(ex.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1.1fr .9fr",
      background: "#ffffff",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* LEFT VISUAL SIDE */}
      <div style={{
        position: "relative",
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}>

        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(14,165,233,.08) 1px, transparent 1px)`,
          backgroundSize: "38px 38px",
          opacity: .8,
        }} />

        <div style={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.accent1}18, transparent 70%)`,
        }} />

        <div style={{
          position: "absolute",
          bottom: "-10%",
          right: "-10%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.accent2}14, transparent 70%)`,
        }} />

        <div style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}>

          <div style={{
            position: "absolute",
            left: "8%",
            top: "7%",
            zIndex: 6,
            maxWidth: 520,
          }}>
            <div style={{
              fontSize: 64,
              fontWeight: 900,
              color: C.text,
              lineHeight: .95,
              letterSpacing: "-.08em",
            }}>
              rate<span style={{ color: C.accent1 }}>-sentinel</span>
            </div>

            <div style={{
              marginTop: 20,
              color: C.muted,
              fontSize: 16,
              maxWidth: 460,
              lineHeight: 1.8,
            }}>
              Intelligent payment protection platform with AI-powered rate limiting,
              OTP orchestration and enterprise-grade transaction monitoring.
            </div>
          </div>

          <div style={{
            position: "absolute",
            left: "-120px",
            top: "48%",
            transform: "translateY(-50%)",
            zIndex: 5,
          }}>
            <div style={{
              background: "#FFFFFF",
              borderRadius: "0 34px 34px 0",
              padding: "20px 20px 20px 0",
              boxShadow: "30px 0 80px rgba(15,23,42,.12)",
            }}>
              <img
                src={robotPeek}
                alt="robot peek"
                style={{
                  width: "46vw",
                  maxWidth: 650,
                  display: "block",
                  filter: "drop-shadow(0 30px 60px rgba(14,165,233,.22))",
                  animation: "robotFloat 5s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          <img
            src={ROBOT_URL}
            alt="robot standing"
            style={{
              position: "absolute",
              right: "4%",
              bottom: "2%",
              width: "30vw",
              maxWidth: 430,
              zIndex: 4,
              filter: "drop-shadow(0 30px 50px rgba(99,102,241,.18))",
              animation: "float 6s ease-in-out infinite",
            }}
          />

          <div style={{
            position: "absolute",
            left: "8%",
            bottom: "8%",
            zIndex: 4,
            opacity: 0,
          }}>
<div />
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN SIDE */}
      <div style={{
        position: "relative",
        background: `linear-gradient(145deg, ${C.accent2} 0%, ${C.accent1} 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
        overflow: "hidden",
      }}>

        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at top right, rgba(255,255,255,.18), transparent 35%)",
        }} />

        <div style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "rgba(255,255,255,.08)",
          top: "-15%",
          right: "-10%",
          filter: "blur(20px)",
        }} />

        <div className="fade-up" style={{
          width: "100%",
          maxWidth: 460,
          position: "relative",
          zIndex: 2,
        }}>

          <div style={{ marginBottom: 28 }}>
            <div style={{
              color: "#ffffff",
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: "-.05em",
              marginBottom: 10,
            }}>
              Welcome Back
            </div>

            <div style={{
              color: "rgba(255,255,255,.75)",
              fontSize: 14,
              letterSpacing: ".04em",
            }}>
              Access your intelligent command centre
            </div>
          </div>

          <div style={{
            background: "rgba(255,255,255,.14)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 28,
            padding: 34,
            boxShadow: "0 30px 80px rgba(0,0,0,.18)",
          }}>
            <form onSubmit={submit}>
              <Field label="Identity">
                <input value={u} onChange={e => setU(e.target.value)} placeholder="username" autoComplete="username" />
              </Field>

              <Field label="Access Key">
                <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </Field>

              {err && (
                <div style={{
                  color: "#fff",
                  fontSize: 12,
                  marginBottom: 14,
                  padding: "10px 14px",
                  background: "rgba(239,68,68,.25)",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.16)",
                }}>
                  ⚠ {err}
                </div>
              )}

              <Btn
                onClick={submit}
                variant="glow"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "15px",
                  fontSize: 13,
                  background: "#ffffff",
                  color: C.accent2,
                  fontWeight: 800,
                  border: "none",
                  boxShadow: "0 12px 30px rgba(255,255,255,.24)",
                }}
              >
                {loading ? <Spinner /> : "LOGIN →"}
              </Btn>
            </form>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "24px 0 16px",
            }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.18)" }} />
              <span style={{ color: "rgba(255,255,255,.6)", fontSize: 10, letterSpacing: ".12em" }}>
                QUICK ACCESS
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.18)" }} />
            </div>

            <div style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 14,
              padding: "14px 16px",
            }}>
              {[["admin","admin123","ADMIN"],["client1","client123","CLIENT"]].map(([user,pass,role]) => (
                <div
                  key={user}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span style={{
                    color: "#ffffff",
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {user} / {pass}
                  </span>

                  <div style={{
                    background: "rgba(255,255,255,.16)",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 10,
                    color: "#ffffff",
                    letterSpacing: ".08em",
                  }}>
                    {role}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── SIDEBAR ─────────────────────────────────────────────────────────────── */
const NAV = [
  { id: "overview", icon: "◈", label: "Overview",    accent: C.accent1 },
  { id: "rules",    icon: "⊟", label: "Rate Rules",  accent: C.accent2 },
  { id: "otp",      icon: "⊛", label: "OTP Tester",  accent: C.accent3 },
  { id: "payments", icon: "◎", label: "Payments",    accent: C.warn },
];

function Sidebar({ active, setActive, username, onLogout }) {
  return (
    <div style={{
      width: 240, position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 10,
      background: "#FFFFFF", borderRight: `1px solid ${C.border}`,
      boxShadow: "4px 0 24px rgba(15,23,42,.06)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Brand */}
      <div style={{ padding: "28px 24px 24px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent1}44, ${C.accent2}44)`,
            border: `1px solid ${C.accent1}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px ${C.accent1}33`,
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent1} strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: C.text, letterSpacing: "-.02em" }}>
              rate<span style={{ color: C.accent1 }}>-sentinel</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: ".08em" }}>COMMAND CTR</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "20px 12px" }}>
        {NAV.map((n, i) => {
          const isActive = active === n.id;
          return (
            <button key={n.id} onClick={() => setActive(n.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              marginBottom: 4, textAlign: "left",
              background: isActive ? n.accent + "18" : "transparent",
              color: isActive ? n.accent : C.muted,
              fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: isActive ? 600 : 400,
              transition: "all .2s",
              position: "relative", overflow: "hidden",
            }}
            onMouseEnter={e => !isActive && (e.currentTarget.style.background = C.dimmed)}
            onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
            >
              {isActive && (
                <div style={{
                  position: "absolute", left: 0, top: "20%", bottom: "20%",
                  width: 3, background: n.accent, borderRadius: "0 2px 2px 0",
                  boxShadow: `0 0 8px ${n.accent}`,
                }} />
              )}
              <span style={{ fontSize: 17, width: 22, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.accent2}, ${C.accent1})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>{username?.[0]?.toUpperCase()}</div>
          <div>
            <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{username}</div>
            <div style={{ color: C.muted, fontSize: 10 }}>Authenticated</div>
          </div>
        </div>
        <Btn onClick={onLogout} variant="ghost" style={{ width: "100%", fontSize: 11, padding: "8px" }}>
          ⏻ Sign Out
        </Btn>
      </div>
    </div>
  );
}

/* ─── OVERVIEW ────────────────────────────────────────────────────────────── */
function Overview({ token }) {
  const [rules, setRules] = useState([]);
  useEffect(() => { api.get("/api/admin/rules", token).then(setRules).catch(() => {}); }, [token]);

  const active = rules.filter(r => r.active).length;
  const byAlgo = ALGO_COLORS;

  return (
    <div>
      <SectionTitle accent={C.accent1}>System Overview</SectionTitle>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Total Rules"   value={<CountUp to={rules.length} />} accent={C.accent1} icon="⊟" delay={0}   sub="configured routes" />
        <StatCard label="Active"        value={<CountUp to={active} />}       accent={C.accent3} icon="●" delay={.05} sub="currently enforced" />
        <StatCard label="Inactive"      value={<CountUp to={rules.length - active} />} accent={C.danger} icon="○" delay={.1} sub="disabled rules" />
        <StatCard label="Algorithms"    value={Object.keys(byAlgo).length}    accent={C.accent2} icon="⊛" delay={.15} sub="strategies loaded" />
      </div>

      {/* API Map */}
      <GlassCard delay={.2} style={{ marginBottom: 20 }}>
        <div style={{ color: C.muted, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 18 }}>
          ◈ API Endpoint Map
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { m:"POST", path:"/api/auth/login",               desc:"Issue JWT token",             pub:true  },
            { m:"POST", path:"/api/v1/otp/generate-otp",      desc:"Generate + dispatch OTP"             },
            { m:"POST", path:"/api/v1/otp/verify-otp",        desc:"Verify OTP code"                     },
            { m:"POST", path:"/api/v1/payment/createPayment", desc:"Idempotent payment"                  },
            { m:"GET",  path:"/api/admin/rules",              desc:"List all rate rules",         admin:true},
            { m:"POST", path:"/api/admin/rules",              desc:"Create rule",                 admin:true},
            { m:"PUT",  path:"/api/admin/rules/{id}",         desc:"Update rule (live)",          admin:true},
            { m:"DELETE",path:"/api/admin/rules/{id}",        desc:"Delete rule",                 admin:true},
          ].map(({ m, path, desc, pub, admin }) => {
            const mc = { GET: C.accent1, POST: C.accent3, PUT: C.warn, DELETE: C.danger }[m];
            return (
              <div key={path} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 14px", borderRadius: 8,
                background: C.dimmed, border: `1px solid ${C.border}`,
                transition: "background .15s",
              }}>
                <span style={{
                  color: mc, fontSize: 10, fontWeight: 700,
                  fontFamily: "'JetBrains Mono',monospace",
                  width: 52, flexShrink: 0, letterSpacing: ".04em",
                }}>{m}</span>
                <span style={{ color: C.accent2, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", flex: 1 }}>{path}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{desc}</span>
                {pub   && <Chip v="PUBLIC" />}
                {admin && <Chip v="ADMIN"  />}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Algorithm Guide */}
      <GlassCard delay={.3}>
        <div style={{ color: C.muted, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 18 }}>
          ⊛ Algorithm Intelligence
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { algo:"SLIDING_WINDOW", color:C.accent2, complexity:"O(log N)", redis:"ZSET", routes:"Auth · OTP", why:"No boundary burst. Rolling window prevents 2× spike at window edge." },
            { algo:"TOKEN_BUCKET",   color:C.accent3, complexity:"O(1)",     redis:"2 keys", routes:"Payments", why:"Burst-tolerant. Tokens accumulate during idle and absorb checkout spikes." },
            { algo:"FIXED_WINDOW",   color:C.warn,    complexity:"O(1)",     redis:"1 key",  routes:"Admin API", why:"Lowest overhead. Boundary burst harmless on internal tooling." },
          ].map(({ algo, color, complexity, redis, routes, why }) => (
            <div key={algo} style={{
              padding: 16, borderRadius: 12,
              background: color + "0A", border: `1px solid ${color}33`,
            }}>
              <div style={{ marginBottom: 10 }}><Chip v={algo} /></div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ color: C.muted, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{complexity}</span>
                <span style={{ color: C.muted, fontSize: 10 }}>·</span>
                <span style={{ color: C.muted, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{redis}</span>
              </div>
              <div style={{ color, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{routes}</div>
              <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{why}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ─── RULES ───────────────────────────────────────────────────────────────── */
const ALGORITHMS = ["SLIDING_WINDOW", "TOKEN_BUCKET", "FIXED_WINDOW"];

function RulesTab({ token }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]   = useState({ msg:"", ok:true });
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({ clientId:"", route:"", requestLimit:100, windowSeconds:60, algorithm:"SLIDING_WINDOW", active:true });

  const show = (msg, ok=true) => { setToast({ msg, ok }); setTimeout(() => setToast({ msg:"" }), 3500); };
  const load = useCallback(async () => {
    setLoading(true);
    try { setRules(await api.get("/api/admin/rules", token)); } catch(e){ show(e.message, false); }
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  function openNew() { setForm({ clientId:"", route:"", requestLimit:100, windowSeconds:60, algorithm:"SLIDING_WINDOW", active:true }); setModal("new"); }
  function openEdit(r){ setForm({...r}); setModal(r); }
  async function save() {
    try {
      if (modal === "new") await api.post("/api/admin/rules", form, token, true);
      else await api.put(`/api/admin/rules/${modal.id}`, form, token);
      show(modal === "new" ? "Rule created" : "Rule updated");
      setModal(null); load();
    } catch(e){ show(e.message, false); }
  }
  async function del(id) {
    if (!window.confirm("Delete this rule?")) return;
    try { await api.del(`/api/admin/rules/${id}`, token); show("Rule deleted"); load(); }
    catch(e){ show(e.message, false); }
  }
  const F = (k,v) => setForm(f => ({...f, [k]:v}));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <SectionTitle accent={C.accent2}>Rate Limit Rules</SectionTitle>
          <p style={{ color:C.muted, fontSize:13, marginTop:-16 }}>Live rule management — changes take effect on next request.</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={load} variant="ghost">{loading ? <Spinner /> : "↻ Sync"}</Btn>
          <Btn onClick={openNew} variant="primary">+ New Rule</Btn>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.4)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>
          <div className="fade-up" style={{
            background:"#FFFFFF", border:`1px solid ${C.border}`,
            borderRadius:18, padding:32, width:480,
            boxShadow:`0 32px 80px rgba(15,23,42,.18), 0 0 0 1px rgba(99,102,241,.08)`,
          }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:24 }}>
              {modal === "new" ? "⊕ Create Rule" : `✎ Edit Rule #${modal.id}`}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="Client ID (* = wildcard)">
                <input value={form.clientId} onChange={e=>F("clientId",e.target.value)} placeholder="client1 or *" />
              </Field>
              <Field label="Route (* = global)">
                <input value={form.route} onChange={e=>F("route",e.target.value)} placeholder="/api/v1/otp/* or *" />
              </Field>
              <Field label="Request Limit">
                <input type="number" value={form.requestLimit} onChange={e=>F("requestLimit",+e.target.value)} />
              </Field>
              <Field label="Window (seconds)">
                <input type="number" value={form.windowSeconds} onChange={e=>F("windowSeconds",+e.target.value)} />
              </Field>
            </div>
            <Field label="Algorithm">
              <select value={form.algorithm} onChange={e=>F("algorithm",e.target.value)}>
                {ALGORITHMS.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24, cursor:"pointer" }}>
              <input type="checkbox" checked={form.active} onChange={e=>F("active",e.target.checked)} style={{ width:"auto", accentColor:C.accent3 }} />
              <span style={{ color:C.muted, fontSize:13 }}>Active</span>
            </label>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn onClick={() => setModal(null)} variant="ghost">Cancel</Btn>
              <Btn onClick={save} variant="primary">Save Rule</Btn>
            </div>
          </div>
        </div>
      )}

      <GlassCard>
        {rules.length === 0 && !loading && (
          <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>
            No rules configured. Create your first rule to begin throttling.
          </div>
        )}
        {rules.length > 0 && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
              <thead>
                <tr>
                  {["ID","Client","Route","Limit / Window","Algorithm","Status",""].map(h => (
                    <th key={h} style={{ color:C.muted, textAlign:"left", padding:"8px 14px", fontWeight:500, fontSize:10, letterSpacing:".08em", textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom:`1px solid ${C.border}22`, transition:"background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accent1+"08"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding:"12px 14px", color:C.muted }}>#{r.id}</td>
                    <td style={{ padding:"12px 14px", color:C.text }}>{r.clientId}</td>
                    <td style={{ padding:"12px 14px", color:C.accent2 }}>{r.route}</td>
                    <td style={{ padding:"12px 14px", color:C.text }}>{r.requestLimit} <span style={{color:C.muted}}>/ {r.windowSeconds}s</span></td>
                    <td style={{ padding:"12px 14px" }}><Chip v={r.algorithm} /></td>
                    <td style={{ padding:"12px 14px" }}><Chip v={r.active ? "ACTIVE" : "INACTIVE"} /></td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:8 }}>
                        <Btn onClick={() => openEdit(r)} variant="ghost" style={{ padding:"5px 12px", fontSize:11 }}>Edit</Btn>
                        <Btn onClick={() => del(r.id)} variant="danger" style={{ padding:"5px 12px", fontSize:11 }}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
      <Toast msg={toast.msg} ok={toast.ok} />
    </div>
  );
}

/* ─── OTP TAB ─────────────────────────────────────────────────────────────── */
const CHANNELS = ["SMS","EMAIL","WHATSAPP"];

function OtpTab({ token }) {
  const [gf, setGf] = useState({ identifier:"", otpType:"SMS" });
  const [vf, setVf] = useState({ identifier:"", otp:"", otpType:"SMS" });
  const [gRes, setGRes] = useState(null);
  const [vRes, setVRes] = useState(null);
  const [toast, setToast] = useState({ msg:"", ok:true });
  const [gLoad, setGLoad] = useState(false);
  const [vLoad, setVLoad] = useState(false);
  const show = (msg, ok=true) => { setToast({ msg, ok }); setTimeout(() => setToast({msg:""}), 3500); };

  async function generate() {
    setGLoad(true); setGRes(null);
    try {
      const r = await api.post(`/api/v1/otp/generate-otp?identifier=${encodeURIComponent(gf.identifier)}&otpType=${gf.otpType}`, {}, token);
      setGRes(r); show(`OTP dispatched via ${gf.otpType}`);
    } catch(e){ show(e.message, false); }
    setGLoad(false);
  }

  async function verify() {
    setVLoad(true); setVRes(null);
    try {
      const r = await api.post(`/api/v1/otp/verify-otp?identifier=${encodeURIComponent(vf.identifier)}&otp=${vf.otp}&otpType=${vf.otpType}`, {}, token);
      setVRes(r); show(r.Verified ? "Verification successful" : "OTP incorrect", r.Verified);
    } catch(e){ show(e.message, false); }
    setVLoad(false);
  }

  return (
    <div>
      <SectionTitle accent={C.accent3}>OTP Tester</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

        {/* Generate */}
        <GlassCard delay={0}>
          <div style={{ color:C.accent3, fontSize:11, fontWeight:600, letterSpacing:".1em", textTransform:"uppercase", marginBottom:20 }}>⊛ Generate OTP</div>
          <Field label="Identifier">
            <input value={gf.identifier} onChange={e=>setGf(f=>({...f,identifier:e.target.value}))} placeholder="+91xxxxxxxxxx or user@email.com" />
          </Field>
          <Field label="Channel">
            <select value={gf.otpType} onChange={e=>setGf(f=>({...f,otpType:e.target.value}))}>
              {CHANNELS.map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <Btn onClick={generate} variant="success" disabled={gLoad || !gf.identifier} style={{ width:"100%", marginBottom: gRes ? 16 : 0 }}>
            {gLoad ? <Spinner /> : "Generate & Dispatch →"}
          </Btn>
          {gRes && (
            <div style={{ background:"rgba(52,211,153,.05)", border:`1px solid ${C.accent3}33`, borderRadius:10, padding:14 }}>
              <div style={{ color:C.muted, fontSize:10, letterSpacing:".08em", marginBottom:8 }}>RESPONSE</div>
              <pre style={{ color:C.accent3, fontSize:12, margin:0, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"pre-wrap" }}>
                {JSON.stringify(gRes, null, 2)}
              </pre>
            </div>
          )}
        </GlassCard>

        {/* Verify */}
        <GlassCard delay={.05}>
          <div style={{ color:C.accent1, fontSize:11, fontWeight:600, letterSpacing:".1em", textTransform:"uppercase", marginBottom:20 }}>✓ Verify OTP</div>
          <Field label="Identifier">
            <input value={vf.identifier} onChange={e=>setVf(f=>({...f,identifier:e.target.value}))} placeholder="+91xxxxxxxxxx or user@email.com" />
          </Field>
          <Field label="OTP Code">
            <input value={vf.otp} onChange={e=>setVf(f=>({...f,otp:e.target.value}))} placeholder="6-digit code" maxLength={6} />
          </Field>
          <Field label="Channel">
            <select value={vf.otpType} onChange={e=>setVf(f=>({...f,otpType:e.target.value}))}>
              {CHANNELS.map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <Btn onClick={verify} variant="primary" disabled={vLoad || !vf.identifier || !vf.otp} style={{ width:"100%", marginBottom: vRes ? 16 : 0 }}>
            {vLoad ? <Spinner /> : "Verify →"}
          </Btn>
          {vRes && (
            <div style={{
              borderRadius:12, padding:20, textAlign:"center",
              background: vRes.Verified ? `${C.accent3}0A` : `${C.danger}0A`,
              border: `1px solid ${vRes.Verified ? C.accent3 : C.danger}44`,
            }}>
              <div style={{ fontSize:36, marginBottom:8 }}>{vRes.Verified ? "✓" : "✗"}</div>
              <div style={{ color: vRes.Verified ? C.accent3 : C.danger, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>
                {vRes.Verified ? "VERIFIED" : "REJECTED"}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Config card */}
      <GlassCard delay={.1} style={{ marginTop:20 }}>
        <div style={{ color:C.muted, fontSize:10, letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>OTP Security Policy</div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {[["Length","6 digits",C.accent1],["Expiry","5 min",C.accent3],["Max Attempts","5",C.warn],["Lockout","15 min",C.danger]].map(([l,v,c])=>(
            <div key={l} style={{ flex:1, minWidth:120, padding:"12px 16px", background:c+"0A", border:`1px solid ${c}22`, borderRadius:10 }}>
              <div style={{ color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>{l}</div>
              <div style={{ color:c, fontSize:18, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <Toast msg={toast.msg} ok={toast.ok} />
    </div>
  );
}

/* ─── PAYMENTS TAB ────────────────────────────────────────────────────────── */
function PaymentsTab({ token }) {
  const [form, setForm] = useState({ username:"client1", amount:"", currency:"INR", description:"" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState({ msg:"", ok:true });
  const show = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast({msg:""}), 3500); };
  const F = (k,v) => setForm(f=>({...f,[k]:v}));

  async function create() {
    setLoading(true); setResult(null);
    const idem = crypto.randomUUID();
    try {
      const params = new URLSearchParams({ username:form.username, amount:form.amount, currency:form.currency, ...(form.description && {description:form.description}) });
      const r = await fetch(`${BASE}/api/v1/payment/createPayment?${params}`, {
        method:"POST",
        headers:{ Authorization:`Bearer ${token}`, "Idempotency-Key":idem },
      });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data = await r.json();
      setResult(data);
      setHistory(h => [{...data, idem},...h].slice(0,10));
      show(`Payment ${data.status} — ID #${data.id}`);
    } catch(e){ show(e.message, false); }
    setLoading(false);
  }

  const statusColor = s => ({ SUCCESS:C.accent3, FAILED:C.danger, PENDING:C.warn }[s] || C.muted);

  return (
    <div>
      <SectionTitle accent={C.warn}>Payment Processor</SectionTitle>
      <div style={{ display:"grid", gridTemplateColumns:"380px 1fr", gap:20, alignItems:"start" }}>

        {/* Form */}
        <GlassCard delay={0}>
          <div style={{ color:C.warn, fontSize:11, fontWeight:600, letterSpacing:".1em", textTransform:"uppercase", marginBottom:20 }}>◎ New Transaction</div>
          <Field label="Username (clientId)"><input value={form.username} onChange={e=>F("username",e.target.value)} /></Field>
          <Field label="Amount"><input type="number" value={form.amount} onChange={e=>F("amount",e.target.value)} placeholder="1000.00" /></Field>
          <Field label="Currency">
            <select value={form.currency} onChange={e=>F("currency",e.target.value)}>
              {["INR","USD","EUR","GBP"].map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description (optional)"><input value={form.description} onChange={e=>F("description",e.target.value)} placeholder="Order #1234" /></Field>

          <div style={{ background:`${C.accent1}08`, borderRadius:8, padding:"10px 12px", marginBottom:16, fontSize:11, color:C.muted, fontFamily:"'JetBrains Mono',monospace" }}>
            🔑 Idempotency-Key auto-generated via <span style={{color:C.accent1}}>crypto.randomUUID()</span>
          </div>

          <Btn onClick={create} variant="glow" disabled={loading||!form.amount} style={{ width:"100%", background:`linear-gradient(135deg,${C.warn}dd,${C.warn}99)`, boxShadow:`0 0 24px ${C.warn}44` }}>
            {loading ? <Spinner /> : "Process Payment →"}
          </Btn>

          {result && (
            <div style={{
              marginTop:16, borderRadius:12, padding:16,
              background: statusColor(result.status) + "0A",
              border:`1px solid ${statusColor(result.status)}44`,
            }}>
              {[["Payment ID", `#${result.id}`], ["Status", result.status], ["Amount", `${result.amount} ${result.currency}`]].map(([l,v])=>(
                <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
                  <span style={{ color:C.muted }}>{l}</span>
                  {l==="Status" ? <Chip v={v} /> : <span style={{ color:C.text }}>{v}</span>}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* History */}
        <GlassCard delay={.05}>
          <div style={{ color:C.muted, fontSize:10, letterSpacing:".1em", textTransform:"uppercase", marginBottom:18 }}>
            Session History <span style={{ color:C.warn }}>({history.length})</span>
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>No transactions this session</div>
          ) : history.map((p, i) => (
            <div key={i} style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"14px 0", borderBottom:`1px solid ${C.border}`,
              animation:`fadeUp .3s ${i*.04}s both`,
            }}>
              <div>
                <div style={{ color:C.text, fontSize:12, fontFamily:"'JetBrains Mono',monospace", marginBottom:3 }}>
                  #{p.id} · <span style={{color:C.warn}}>{p.amount} {p.currency}</span>
                </div>
                <div style={{ color:C.muted, fontSize:10 }}>{p.clientId} · {p.idem?.substring(0,16)}…</div>
              </div>
              <Chip v={p.status} />
            </div>
          ))}
        </GlassCard>
      </div>
      <Toast msg={toast.msg} ok={toast.ok} />
    </div>
  );
}

/* ─── APP ROOT ────────────────────────────────────────────────────────────── */
export default function App() {
  const [token, setToken]     = useState(null);
  const [username, setUsername] = useState("");
  const [active, setActive]   = useState("overview");

  const tabs = {
    overview: <Overview token={token} />,
    rules:    <RulesTab token={token} />,
    otp:      <OtpTab   token={token} />,
    payments: <PaymentsTab token={token} />,
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {!token ? (
        <Login onLogin={(t, u) => { setToken(t); setUsername(u); }} />
      ) : (
        <div style={{ background: C.bg, minHeight: "100vh" }}>
          <Sidebar active={active} setActive={setActive} username={username} onLogout={() => { setToken(null); setUsername(""); }} />
          <main style={{ marginLeft:240, padding:"36px 40px", minHeight:"100vh", background: C.bg }}>
            {tabs[active]}
          </main>
        </div>
      )}
    </>
  );
}
