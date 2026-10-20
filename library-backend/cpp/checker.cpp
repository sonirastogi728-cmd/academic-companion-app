// ==========================================================================
//  checker.cpp  -  C++ answer-key checker used by the Task Tracking backend
//
//  The Node server runs this program for every student assignment upload:
//      checker <keys.txt> <answer.txt> <maxMarks>
//  keys.txt   : one faculty key word / phrase per line
//  answer.txt : the student's answer text
//  Output     : one line of JSON, e.g.
//      {"matched":3,"total":4,"score":7.5,"max":10,"missing":["template"]}
//
//  Build (Windows / Linux / Mac):  g++ -std=c++17 checker.cpp -o checker
//  OOP used: class with constructor, const member functions, custom
//  exception, operator<< for the result, file streams, STL algorithms.
// ==========================================================================
#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

class CheckerError : public runtime_error {
public:
    explicit CheckerError(const string &m) : runtime_error(m) {}
};

// lower-case and collapse every run of whitespace into a single space
static string normalise(const string &s) {
    string out;
    bool space = false;
    for (unsigned char c : s) {
        if (isspace(c)) { space = true; continue; }
        if (space && !out.empty()) out += ' ';
        space = false;
        out += (char)tolower(c);
    }
    return out;
}

static string readFile(const string &path) {
    ifstream f(path, ios::binary);
    if (!f) throw CheckerError("cannot open " + path);
    stringstream buf;
    buf << f.rdbuf();
    return buf.str();
}

static string jsonEscape(const string &s) {
    string o;
    for (unsigned char c : s) {
        switch (c) {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            default:
                if (c < 0x20) { char b[8]; snprintf(b, sizeof b, "\\u%04x", c); o += b; }
                else o += (char)c;
        }
    }
    return o;
}

struct Result {
    int matched = 0;
    int total = 0;
    double score = 0;
    double max = 0;
    vector<string> missing;

    friend ostream &operator<<(ostream &os, const Result &r) {
        os << "{\"matched\":" << r.matched << ",\"total\":" << r.total << ",\"score\":" << fixed
           << setprecision(2) << r.score << ",\"max\":" << r.max << ",\"missing\":[";
        for (size_t i = 0; i < r.missing.size(); i++) os << (i ? "," : "") << "\"" << jsonEscape(r.missing[i]) << "\"";
        return os << "]}";
    }
};

class KeyChecker {
    vector<string> keys;
    double maxMarks;

public:
    KeyChecker(const string &keysPath, double maxMarks) : maxMarks(maxMarks) {
        istringstream in(readFile(keysPath));
        string line;
        while (getline(in, line)) {
            string k = line;
            while (!k.empty() && (k.back() == '\r' || k.back() == ' ')) k.pop_back();
            if (!normalise(k).empty()) keys.push_back(k);
        }
        if (keys.empty()) throw CheckerError("no keys supplied");
    }

    Result check(const string &answer) const {
        const string text = normalise(answer);
        Result r;
        r.total = (int)keys.size();
        r.max = maxMarks;
        for (const string &k : keys) {
            if (text.find(normalise(k)) != string::npos) r.matched++;
            else r.missing.push_back(k);
        }
        r.score = maxMarks * r.matched / r.total;
        return r;
    }
};

int main(int argc, char **argv) {
    if (argc != 4) {
        cerr << "usage: checker <keys.txt> <answer.txt> <maxMarks>\n";
        return 2;
    }
    try {
        double maxMarks = stod(argv[3]);
        KeyChecker checker(argv[1], maxMarks);
        cout << checker.check(readFile(argv[2])) << "\n";
        return 0;
    } catch (const exception &e) {
        cerr << "{\"error\":\"" << jsonEscape(e.what()) << "\"}\n";
        return 1;
    }
}
