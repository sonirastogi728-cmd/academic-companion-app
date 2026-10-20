const FACULTY_CODE = "FAC2026"; // learning stage only; backend will own this later

const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
};
const write = (key, list) => localStorage.setItem(key, JSON.stringify(list));
const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;

// ---------- lookups ----------
export const usernameOf = (id) =>
  read("users").find((u) => u.id === id)?.username || "unknown";

export const getSubject = (id) => read("subjects").find((s) => s.id === id);

export const isEnrolled = (studentId, subjectId) =>
  read("enrollments").some(
    (e) => e.studentId === studentId && e.subjectId === subjectId
  );

export const allSubjects = () => read("subjects");

export const subjectsOwnedBy = (facultyId) =>
  read("subjects").filter((s) => s.facultyId === facultyId);

export const subjectsOfStudent = (studentId) =>
  read("subjects").filter((s) => isEnrolled(studentId, s.id));

export const unitsOf = (subjectId) =>
  read("units").filter((u) => u.subjectId === subjectId);

export const resourcesOf = (unitId) =>
  read("resources").filter((r) => r.unitId === unitId);

export const enrolledStudents = (subjectId) =>
  read("enrollments")
    .filter((e) => e.subjectId === subjectId)
    .map((e) => usernameOf(e.studentId));

// ---------- permission checks ----------
export const canEditSubject = (user, subjectId) => {
  const s = getSubject(subjectId);
  return !!user && user.role === "faculty" && !!s && s.facultyId === user.id;
};

export const canAccessSubject = (user, subjectId) => {
  if (!user || !getSubject(subjectId)) return false;
  if (user.role === "faculty") return canEditSubject(user, subjectId);
  return isEnrolled(user.id, subjectId);
};

// ---------- session ----------
export const getSessionUser = () => {
  const id = Number(localStorage.getItem("session"));
  return read("users").find((u) => u.id === id) || null;
};

export const logOut = () => localStorage.removeItem("session");

// ---------- sign up / log in ----------
export function signUp({ username, password, role, code }) {
  const name = username.trim();
  const users = read("users");
  if (!name || users.some((u) => u.username === name))
    return { ok: false, message: "Username is empty or already taken." };
  if (!password)
    return { ok: false, message: "Password cannot be empty." };
  if (role === "faculty" && code !== FACULTY_CODE)
    return { ok: false, message: "Wrong faculty code. Account not created." };

  users.push({ id: nextId(users), username: name, password, role });
  write("users", users);
  return { ok: true, message: "Account created. You can log in now." };
}

export function logIn(username, password) {
  const user = read("users").find(
    (u) => u.username === username.trim() && u.password === password
  );
  if (!user) return { ok: false, message: "Wrong username or password." };
  localStorage.setItem("session", String(user.id));
  return { ok: true, user };
}

// ---------- faculty actions ----------
export function addSubject(user, name) {
  if (!user || user.role !== "faculty")
    return { ok: false, message: "You are not allowed to do that." };
  const n = name.trim();
  if (!n) return { ok: false, message: "Name cannot be empty." };
  const subjects = read("subjects");
  if (subjects.some((s) => s.name === n))
    return { ok: false, message: "That subject already exists." };
  subjects.push({ id: nextId(subjects), name: n, facultyId: user.id });
  write("subjects", subjects);
  return { ok: true, message: "Subject added." };
}

export function addUnit(user, subjectId, name) {
  if (!canEditSubject(user, subjectId))
    return { ok: false, message: "This subject is not yours." };
  const n = name.trim();
  if (!n) return { ok: false, message: "Name cannot be empty." };
  const units = read("units");
  units.push({ id: nextId(units), subjectId, name: n });
  write("units", units);
  return { ok: true, message: "Unit added." };
}

export function addResource(user, subjectId, unitId, title, type, location) {
  if (!canEditSubject(user, subjectId))
    return { ok: false, message: "This subject is not yours." };
  if (!unitsOf(subjectId).some((u) => u.id === unitId))
    return { ok: false, message: "Choose a unit first." };
  if (!title.trim() || !location.trim())
    return { ok: false, message: "Title and location are required." };
  const resources = read("resources");
  resources.push({
    id: nextId(resources),
    unitId,
    title: title.trim(),
    type,
    location: location.trim(),
  });
  write("resources", resources);
  return { ok: true, message: "Material added." };
}

// ---------- student actions ----------
export function enroll(user, subjectId) {
  if (!user || user.role !== "student")
    return { ok: false, message: "You are not allowed to do that." };
  if (!getSubject(subjectId))
    return { ok: false, message: "Subject not found." };
  if (isEnrolled(user.id, subjectId))
    return { ok: false, message: "Already enrolled." };
  const list = read("enrollments");
  list.push({ studentId: user.id, subjectId });
  write("enrollments", list);
  return { ok: true, message: "Enrolled." };
}