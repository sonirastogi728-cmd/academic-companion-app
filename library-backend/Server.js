const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const FACULTY_CODE = "FAC2026";
const FILE = "db.json";

// ---------- storage (replaces your .txt files) ----------
let db = { users: [], subjects: [], enrollments: [], units: [], resources: [] };
if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;

const sessions = {}; // token -> userId

// ---------- helpers ----------
const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });
const usernameOf = (id) => db.users.find((u) => u.id === id)?.username || "unknown";
const isEnrolled = (studentId, subjectId) =>
  db.enrollments.some((e) => e.studentId === studentId && e.subjectId === subjectId);
const canEdit = (user, s) => user.role === "faculty" && s.facultyId === user.id;
const canAccess = (user, s) =>
  user.role === "faculty" ? s.facultyId === user.id : isEnrolled(user.id, s.id);

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const user = db.users.find((u) => u.id === sessions[token]);
  if (!user) return res.status(401).json({ message: "Please log in first." });
  req.user = user;
  req.token = token;
  next();
}

function findSubject(req, res) {
  const s = db.subjects.find((x) => x.id === Number(req.params.id));
  if (!s) res.status(404).json({ message: "Subject not found." });
  return s;
}

// ---------- routes ----------
app.get("/", (req, res) => res.send("Library backend is running"));

app.post("/api/signup", (req, res) => {
  const { username = "", password = "", role, code } = req.body;
  const name = String(username).trim();
  if (!name || db.users.some((u) => u.username === name))
    return res.status(400).json({ message: "Username is empty or already taken." });
  if (!password) return res.status(400).json({ message: "Password cannot be empty." });
  if (role !== "student" && role !== "faculty")
    return res.status(400).json({ message: "Invalid role." });
  if (role === "faculty" && code !== FACULTY_CODE)
    return res.status(403).json({ message: "Wrong faculty code. Account not created." });

  db.users.push({ id: nextId(db.users), username: name, password, role });
  save();
  res.json({ message: "Account created. You can log in now." });
});

app.post("/api/login", (req, res) => {
  const { username = "", password = "" } = req.body;
  const user = db.users.find(
    (u) => u.username === String(username).trim() && u.password === password
  );
  if (!user) return res.status(401).json({ message: "Wrong username or password." });
  const token = crypto.randomUUID();
  sessions[token] = user.id;
  res.json({ token, user: publicUser(user) });
});

app.post("/api/logout", auth, (req, res) => {
  delete sessions[req.token];
  res.json({ message: "Logged out." });
});

app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get("/api/subjects", auth, (req, res) => {
  const u = req.user;
  let list = db.subjects;
  if (req.query.scope === "all") {
    if (u.role !== "student")
      return res.status(403).json({ message: "You are not allowed to do that." });
  } else {
    list =
      u.role === "faculty"
        ? list.filter((s) => s.facultyId === u.id)
        : list.filter((s) => isEnrolled(u.id, s.id));
  }
  res.json({
    subjects: list.map((s) => ({
      id: s.id,
      name: s.name,
      facultyName: usernameOf(s.facultyId),
      enrolled: u.role === "student" && isEnrolled(u.id, s.id),
    })),
  });
});

app.post("/api/subjects", auth, (req, res) => {
  if (req.user.role !== "faculty")
    return res.status(403).json({ message: "You are not allowed to do that." });
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Name cannot be empty." });
  if (db.subjects.some((s) => s.name === name))
    return res.status(400).json({ message: "That subject already exists." });
  db.subjects.push({ id: nextId(db.subjects), name, facultyId: req.user.id });
  save();
  res.json({ message: "Subject added." });
});

app.get("/api/subjects/:id", auth, (req, res) => {
  const s = findSubject(req, res);
  if (!s) return;
  if (!canAccess(req.user, s))
    return res.status(403).json({ message: "You cannot open this subject." });
  const editable = canEdit(req.user, s);
  const units = db.units
    .filter((u) => u.subjectId === s.id)
    .map((u) => ({
      id: u.id,
      name: u.name,
      resources: db.resources.filter((r) => r.unitId === u.id),
    }));
  res.json({
    subject: {
      id: s.id,
      name: s.name,
      facultyName: usernameOf(s.facultyId),
      canEdit: editable,
      units,
      students: editable
        ? db.enrollments.filter((e) => e.subjectId === s.id).map((e) => usernameOf(e.studentId))
        : [],
    },
  });
});

app.post("/api/subjects/:id/units", auth, (req, res) => {
  const s = findSubject(req, res);
  if (!s) return;
  if (!canEdit(req.user, s))
    return res.status(403).json({ message: "This subject is not yours." });
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Name cannot be empty." });
  db.units.push({ id: nextId(db.units), subjectId: s.id, name });
  save();
  res.json({ message: "Unit added." });
});

app.post("/api/subjects/:id/resources", auth, (req, res) => {
  const s = findSubject(req, res);
  if (!s) return;
  if (!canEdit(req.user, s))
    return res.status(403).json({ message: "This subject is not yours." });
  const { unitId, type } = req.body;
  const title = String(req.body.title || "").trim();
  const location = String(req.body.location || "").trim();
  if (!db.units.some((u) => u.id === Number(unitId) && u.subjectId === s.id))
    return res.status(400).json({ message: "Choose a unit first." });
  if (!["PDF", "PPT", "DOC", "LINK"].includes(type))
    return res.status(400).json({ message: "Invalid type." });
  if (!title || !location)
    return res.status(400).json({ message: "Title and location are required." });
  db.resources.push({ id: nextId(db.resources), unitId: Number(unitId), title, type, location });
  save();
  res.json({ message: "Material added." });
});

app.post("/api/subjects/:id/enroll", auth, (req, res) => {
  if (req.user.role !== "student")
    return res.status(403).json({ message: "You are not allowed to do that." });
  const s = findSubject(req, res);
  if (!s) return;
  if (isEnrolled(req.user.id, s.id))
    return res.status(400).json({ message: "Already enrolled." });
  db.enrollments.push({ studentId: req.user.id, subjectId: s.id });
  save();
  res.json({ message: "Enrolled." });
});
require("./tasks")({ app, db, save, auth, canEdit, canAccess });
app.listen(4000, () => console.log("Library backend on http://localhost:4000"));