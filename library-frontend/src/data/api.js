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
export async function addResource(id, unitId, title, file, link) {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("unitId", unitId);
  form.append("title", title);
  if (link) form.append("link", link);
  if (file) form.append("file", file);
  try {
    const res = await fetch(`${BASE}/subjects/${id}/resources`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, message: "Cannot reach server. Is the backend running?" };
  }
}

export const deleteResource = (id, rid) =>
  request(`/subjects/${id}/resources/${rid}`, "DELETE");

// View in a new tab, or download to the user's computer
export async function openFile(resource, download) {
  const token = localStorage.getItem("token");
  const win = download ? null : window.open("", "_blank");
  try {
    const res = await fetch(`${BASE}/files/${resource.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      if (win) win.close();
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: data.message || "Could not open the file." };
    }
    const url = URL.createObjectURL(await res.blob());
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = resource.originalName || "file";
      a.click();
    } else {
      win.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { ok: true };
  } catch {
    if (win) win.close();
    return { ok: false, message: "Cannot reach server. Is the backend running?" };
  }
}
export const enroll = (id) => request(`/subjects/${id}/enroll`, "POST");
export const deleteSubject = (id) => request(`/subjects/${id}`, "DELETE");
export const deleteUnit = (id, unitId) =>
  request(`/subjects/${id}/units/${unitId}`, "DELETE");