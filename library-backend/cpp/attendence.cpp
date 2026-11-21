#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <map>
#include <string>
using namespace std;

struct Entry {
    string subjectId, date, studentId;
    bool present;
};

class AttendanceManager {
    vector<Entry> entries;
    string file;

public:
    AttendanceManager(string f) : file(f) { load(); }

    void load() {
        ifstream in(file);
        string line;
        while (getline(in, line)) {
            stringstream ss(line);
            Entry e; string p;
            getline(ss, e.subjectId, '|');
            getline(ss, e.date, '|');
            getline(ss, e.studentId, '|');
            getline(ss, p, '|');
            e.present = (p == "1");
            entries.push_back(e);
        }
    }

    void save() {
        ofstream out(file);
        for (auto &e : entries)
            out << e.subjectId << '|' << e.date << '|'
                << e.studentId << '|' << e.present << '\n';
    }

    // replaces any earlier marking of same subject + date
    void mark(const string &sub, const string &date,
              const vector<pair<string, bool>> &recs) {
        vector<Entry> kept;
        for (auto &e : entries)
            if (!(e.subjectId == sub && e.date == date)) kept.push_back(e);
        entries = kept;
        for (auto &r : recs)
            entries.push_back({sub, date, r.first, r.second});
        save();
    }

    void printSubject(const string &sub) {
        cout << "[";
        bool first = true;
        for (auto &e : entries) {
            if (e.subjectId != sub) continue;
            if (!first) cout << ",";
            first = false;
            cout << "{\"date\":\"" << e.date << "\",\"studentId\":\""
                 << e.studentId << "\",\"present\":"
                 << (e.present ? "true" : "false") << "}";
        }
        cout << "]";
    }

    void printStudent(const string &id) {
        map<string, pair<int, int>> m; // subject -> (attended, total)
        for (auto &e : entries) {
            if (e.studentId != id) continue;
            m[e.subjectId].second++;
            if (e.present) m[e.subjectId].first++;
        }
        cout << "[";
        bool first = true;
        for (auto &kv : m) {
            if (!first) cout << ",";
            first = false;
            int a = kv.second.first, t = kv.second.second;
            cout << "{\"subjectId\":\"" << kv.first << "\",\"attended\":" << a
                 << ",\"total\":" << t << ",\"percent\":" << (a * 100 / t) << "}";
        }
        cout << "]";
    }
};

int main(int argc, char *argv[]) {
    if (argc < 2) { cout << "{\"error\":\"no command\"}"; return 1; }
    AttendanceManager mgr("attendance.txt");
    string cmd = argv[1];

    if (cmd == "mark" && argc >= 5) {
        vector<pair<string, bool>> recs;
        for (int i = 4; i < argc; i++) {       // each arg: studentId:1 or studentId:0
            string a = argv[i];
            size_t pos = a.rfind(':');
            recs.push_back({a.substr(0, pos), a.substr(pos + 1) == "1"});
        }
        mgr.mark(argv[2], argv[3], recs);
        cout << "{\"ok\":true}";
    } else if (cmd == "subject" && argc >= 3) {
        mgr.printSubject(argv[2]);
    } else if (cmd == "student" && argc >= 3) {
        mgr.printStudent(argv[2]);
    } else {
        cout << "{\"error\":\"bad command\"}";
        return 1;
    }
    return 0;
}