# Academic Companion App (College Buddy)

An intelligent digital companion for college. Faculty publish study material and tasks, and students view, download and complete them. Built for our **C++ + Data Structures PBL project**, Department of Computer Science & Engineering, Graphic Era (Deemed to be University).

## Modules

| Module | Status | What it does |
|---|---|---|
| Library | Done | Faculty add subjects, units and materials (uploaded files or links). Students see only the subjects they enrolled in. |
| Task Tracking | In progress | Faculty create quizzes and assignments. Students submit, and a C++ checker scores them against answer keys. |
| Attendance Tracker | Planned | Attendance records per subject. |
| Notification Prioritizer | Planned | Ranks notifications by importance. |

## Library features
- Sign up and log in as **Student** or **Faculty**. Faculty sign-up needs a faculty code.
- Faculty can add and remove their own subjects, units and materials, and cannot edit anyone else's.
- Duplicate unit names are blocked inside a subject.
- Upload real files (up to 20 MB) or paste a link. Students can **View** or **Download** them.
- Students enroll in subjects and see only those. Faculty see the list of enrolled students.
- File handling (validation, storing, deleting) is done by a **C++ program**, `filemanager.cpp`.

## Tech stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express (REST API, token login)
- **C++:** `filemanager.cpp` (file handling) and `checker.cpp` (answer checking)
- **Storage:** `db.json` and an `uploads/` folder (Stage 1, no database yet)

## Project structure
```
academic-companion-app/
├── library-backend/
│   ├── Server.js            Express server and all rules
│   ├── tasks.js             Task tracking routes
│   ├── cpp/
│   │   ├── filemanager.cpp  Validates, stores and deletes uploaded files
│   │   └── checker.cpp      Checks answers against keys
│   └── db.json              Data file
└── library-frontend/
    └── src/
        ├── App.jsx
        ├── components/      AuthPage, Dashboard, SubjectView
        ├── data/api.js      All calls to the backend
        └── TaskTracker.jsx, QuizPlayer.jsx, FacultyPanel.jsx, taskApi.js
```

## How to run
You need Node.js and a C++ compiler (g++).

**1. Backend**
```
cd library-backend
npm install
g++ -std=c++17 cpp/filemanager.cpp -o cpp/filemanager.exe
g++ -std=c++17 cpp/checker.cpp -o cpp/checker.exe
node Server.js
```
The server runs on `http://localhost:4000`.

**2. Frontend** (in a second terminal)
```
cd library-frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Main API routes
| Method | Route | Who |
|---|---|---|
| POST | `/api/signup`, `/api/login` | Everyone |
| GET / POST | `/api/subjects` | Faculty (own), students (enrolled) |
| DELETE | `/api/subjects/:id` | Owner faculty |
| POST / DELETE | `/api/subjects/:id/units` | Owner faculty |
| POST / DELETE | `/api/subjects/:id/resources` | Owner faculty |
| GET | `/api/files/:rid` | Enrolled student, owner faculty |
| POST | `/api/subjects/:id/enroll` | Student |

## Team

| Member | GitHub | Contribution |
|---|---|---|
| Soni Rastogi | [@sonirastogi728-cmd](https://github.com/sonirastogi728-cmd) | Backend core, library module, file upload |
| Shruti Agarwal | [@shrutiagarwal23-git](https://github.com/shrutiagarwal23-git) | Task tracker UI, frontend API |
| Ashita Rawat | Ashita | Database, checker, C++ file manager |
| Abhya Verma | Abhya | Main app, components, library UI |

## Branches and commits
- `main` holds the latest working version.
- Each member works on a personal branch (`abhya-files`, `ashita-files`) and merges into `main` through a pull request.
- Commit messages describe what changed, for example "Backend: file upload/download, remove subject/unit/material".

## Known limitations (Stage 1)
- Passwords are stored as plain text and `db.json` is a file, not a database.
- Sessions are lost when the server restarts.

## Roadmap
1. **Stage 1:** C++ + OOP + data structures, text/JSON storage (this version)
2. **Stage 2:** Database, operating-system concepts and Dart
3. **Stage 3:** Automation, trained models and stronger security
