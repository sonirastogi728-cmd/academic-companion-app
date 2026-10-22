
#include <iostream>
#include <fstream>
#include <filesystem>
#include <string>
#include <vector>
#include <algorithm>
#include <chrono>
#include <cctype>
using namespace std;
namespace fs = std::filesystem;

static string jsonEscape(const string& s) {
    string out;
    for (char c : s) {
        if (c == '"' || c == '\\') { out += '\\'; out += c; }
        else if ((unsigned char)c < 32) out += ' ';
        else out += c;
    }
    return out;
}

static void fail(const string& msg) {
    cout << "{\"ok\":false,\"message\":\"" << jsonEscape(msg) << "\"}" << endl;
}

static string toLower(string s) {
    for (char& c : s) c = (char)tolower((unsigned char)c);
    return s;
}

// Only these extensions may be stored (blocks .exe, .html, .js, etc.)
static bool extensionAllowed(const string& ext) {
    static const vector<string> allowed = {
        ".pdf", ".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx",
        ".txt", ".png", ".jpg", ".jpeg", ".zip", ".c", ".cpp", ".h"};
    return find(allowed.begin(), allowed.end(), ext) != allowed.end();
}

// Keep only letters, digits, '.', '-' and '_' (no folders, no strange symbols).
static string cleanName(const string& original) {
    string base = fs::path(original).filename().string();
    string out;
    for (char c : base) {
        if (isalnum((unsigned char)c) || c == '.' || c == '-' || c == '_') out += c;
        else out += '_';
    }
    return out;
}

static void storeFile(const string& src, const string& destDir,
                      const string& original, long long maxBytes) {
    error_code ec;
    if (!fs::exists(src, ec) || !fs::is_regular_file(src, ec)) {
        fail("Uploaded file not found.");
        return;
    }
    long long size = (long long)fs::file_size(src, ec);
    if (ec) { fail("Could not read the uploaded file."); return; }
    if (size == 0) { fail("File is empty."); fs::remove(src, ec); return; }
    if (size > maxBytes) { fail("File is too large."); fs::remove(src, ec); return; }

    string clean = cleanName(original);
    string ext = toLower(fs::path(clean).extension().string());
    if (!extensionAllowed(ext)) {
        fail("This file type is not allowed.");
        fs::remove(src, ec);
        return;
    }
    string stem = fs::path(clean).stem().string();
    if (stem.size() > 50) stem = stem.substr(0, 50);

    fs::create_directories(destDir, ec);

    // unique stored name = time stamp + cleaned name
    long long stamp = chrono::duration_cast<chrono::milliseconds>(
        chrono::system_clock::now().time_since_epoch()).count();
    string stored = to_string(stamp) + "_" + stem + ext;
    fs::path dest = fs::path(destDir) / stored;
    int n = 1;
    while (fs::exists(dest, ec)) {
        stored = to_string(stamp) + "_" + to_string(n++) + "_" + stem + ext;
        dest = fs::path(destDir) / stored;
    }

    // copy byte by byte (file I/O)
    ifstream in(src, ios::binary);
    ofstream out(dest, ios::binary);
    if (!in || !out) { fail("Could not open the file for copying."); return; }
    char buf[64 * 1024];
    long long copied = 0;
    while (in) {
        in.read(buf, sizeof buf);
        streamsize got = in.gcount();
        if (got > 0) { out.write(buf, got); copied += got; }
    }
    out.flush();
    bool wroteOk = (bool)out;
    out.close();
    in.close();

    if (!wroteOk || copied != size) {
        fs::remove(dest, ec);
        fail("Copy failed. Please try again.");
        return;
    }
    fs::remove(src, ec); // delete the temporary upload
    cout << "{\"ok\":true,\"storedName\":\"" << jsonEscape(stored)
         << "\",\"size\":" << size << "}" << endl;
}

static void removeFile(const string& destDir, const string& stored) {
    // the name must be a plain file name, never a path like ..\..\x
    if (stored.empty() || fs::path(stored).filename().string() != stored) {
        fail("Invalid file name.");
        return;
    }
    error_code ec;
    fs::path target = fs::path(destDir) / stored;
    if (!fs::exists(target, ec)) {
        cout << "{\"ok\":true,\"message\":\"Already removed.\"}" << endl;
        return;
    }
    if (!fs::remove(target, ec) || ec) { fail("Could not delete the file."); return; }
    cout << "{\"ok\":true}" << endl;
}

int main(int argc, char* argv[]) {
    string cmd = argc > 1 ? argv[1] : "";
    if (cmd == "store" && argc == 6) {
        long long maxBytes = 0;
        try { maxBytes = stoll(argv[5]); }
        catch (...) { fail("Bad size limit."); return 0; }
        storeFile(argv[2], argv[3], argv[4], maxBytes);
    } else if (cmd == "remove" && argc == 4) {
        removeFile(argv[2], argv[3]);
    } else {
        fail("Usage: filemanager store <src> <destDir> <name> <maxBytes> | remove <destDir> <storedName>");
    }
    return 0;
}