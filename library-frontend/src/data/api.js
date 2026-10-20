const BASE = "http://localhost:4000/api";

async function request(path, method = "GET", body) {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, message: "Cannot reach server. Is the backend running?" };
  }
}

export const signUp = (form) => request("/signup", "POST", form);

export async function logIn(username, password) {
  const res = await request("/login", "POST", { username, password });
  if (res.ok) localStorage.setItem("token", res.token);
  return res;
}

export async function logOut() {
  await request("/logout", "POST");
  localStorage.removeItem("token");
}

export const getMe = () => request("/me");
export const getSubjects = (scope) => request(`/subjects?scope=${scope}`);
export const addSubject = (name) => request("/subjects", "POST", { name });
export const getSubject = (id) => request(`/subjects/${id}`);
export const addUnit = (id, name) => request(`/subjects/${id}/units`, "POST", { name });
export const addResource = (id, unitId, title, type, location) =>
  request(`/subjects/${id}/resources`, "POST", { unitId, title, type, location });
export const enroll = (id) => request(`/subjects/${id}/enroll`, "POST");