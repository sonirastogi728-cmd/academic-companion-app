import { useState } from "react";
import { signUp, logIn } from "../data/api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === "signup") {
      const res = await signUp({ username, password, role, code });
      setMessage(res.message);
      if (res.ok) { setMode("login"); setPassword(""); setCode(""); }
    } else {
      const res = await logIn(username, password);
      if (res.ok) onLogin(res.user);
      else setMessage(res.message);
    }
  }

  return (
    <div className="auth-box">
      <h1>Library System</h1>
      <p className="muted">{mode === "login" ? "Log in" : "Create account"}</p>

      <form onSubmit={handleSubmit}>
        <input placeholder="Username" value={username}
          onChange={(e) => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} />

        {mode === "signup" && (
          <>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
            {role === "faculty" && (
              <input placeholder="Faculty code" value={code}
                onChange={(e) => setCode(e.target.value)} />
            )}
          </>
        )}

        <button type="submit">{mode === "login" ? "Log in" : "Sign up"}</button>
      </form>

      {message && <p className="message">{message}</p>}

      <button className="link-btn"
        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
        {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
      </button>
    </div>
  );
}