/* jobrun.exe - tiny launcher that runs ONE student program inside a Windows
 * Job Object so the OS itself enforces limits (no polling, no overshoot):
 *   - committed-memory cap for the whole job (allocation just fails past it)
 *   - at most 1 process in the job (no fork bombs / `start /b` escapes)
 *   - KILL_ON_JOB_CLOSE (if this launcher dies, the program dies with it)
 *   - below-normal CPU priority
 * Usage: jobrun.exe <memLimitBytes> <peakKbFile|-> <program.exe>
 * stdin/stdout/stderr are inherited, so the caller's pipes talk straight to
 * the program. Exit code = the program's own, except EXIT_MLE when it hit the
 * memory cap and EXIT_HELPER on a launcher-side failure.
 * Build: gcc -Os -s -o jobrun.exe jobrun.c   (see build-jobrun.js) */
#define _WIN32_WINNT 0x0602
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>

#define EXIT_MLE    0x7F4D4C45u
#define EXIT_HELPER 0x7F4A4F42u

int main(int argc, char **argv) {
    if (argc < 4) return (int)EXIT_HELPER;
    unsigned long long limit = strtoull(argv[1], NULL, 10);

    HANDLE job = CreateJobObjectA(NULL, NULL);
    HANDLE port = CreateIoCompletionPort(INVALID_HANDLE_VALUE, NULL, 0, 1);
    if (!job || !port) { fprintf(stderr, "jobrun: cannot create job\n"); return (int)EXIT_HELPER; }

    JOBOBJECT_ASSOCIATE_COMPLETION_PORT cp;
    cp.CompletionKey = (PVOID)1;
    cp.CompletionPort = port;
    SetInformationJobObject(job, JobObjectAssociateCompletionPortInformation, &cp, sizeof cp);

    JOBOBJECT_EXTENDED_LIMIT_INFORMATION li;
    ZeroMemory(&li, sizeof li);
    li.BasicLimitInformation.LimitFlags =
        JOB_OBJECT_LIMIT_JOB_MEMORY | JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    li.BasicLimitInformation.ActiveProcessLimit = 1;
    li.JobMemoryLimit = (SIZE_T)limit;
    if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, &li, sizeof li)) {
        fprintf(stderr, "jobrun: cannot set limits\n");
        return (int)EXIT_HELPER;
    }

    char cmd[2048];
    snprintf(cmd, sizeof cmd, "\"%s\"", argv[3]);
    STARTUPINFOA si;
    ZeroMemory(&si, sizeof si);
    si.cb = sizeof si;
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
    PROCESS_INFORMATION pi;
    /* Suspended so it can't allocate or spawn before it is inside the job. */
    if (!CreateProcessA(NULL, cmd, NULL, NULL, TRUE,
                        CREATE_SUSPENDED | BELOW_NORMAL_PRIORITY_CLASS | CREATE_NO_WINDOW,
                        NULL, NULL, &si, &pi)) {
        fprintf(stderr, "jobrun: cannot start program (error %lu)\n", GetLastError());
        return (int)EXIT_HELPER;
    }
    if (!AssignProcessToJobObject(job, pi.hProcess)) {
        fprintf(stderr, "jobrun: cannot assign to job (error %lu)\n", GetLastError());
        TerminateProcess(pi.hProcess, 1);
        return (int)EXIT_HELPER;
    }
    ResumeThread(pi.hThread);
    WaitForSingleObject(pi.hProcess, INFINITE);

    DWORD code = 0;
    GetExitCodeProcess(pi.hProcess, &code);

    int hitLimit = 0;
    DWORD msg; ULONG_PTR key; LPOVERLAPPED ov;
    while (GetQueuedCompletionStatus(port, &msg, &key, &ov, 0)) {
        if (msg == JOB_OBJECT_MSG_JOB_MEMORY_LIMIT || msg == JOB_OBJECT_MSG_PROCESS_MEMORY_LIMIT) hitLimit = 1;
    }

    if (argv[2][0] != '-') {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION out;
        if (QueryInformationJobObject(job, JobObjectExtendedLimitInformation, &out, sizeof out, NULL)) {
            FILE *f = fopen(argv[2], "w");
            if (f) { fprintf(f, "%llu", (unsigned long long)(out.PeakJobMemoryUsed / 1024)); fclose(f); }
        }
    }
    return hitLimit ? (int)EXIT_MLE : (int)code;
}
