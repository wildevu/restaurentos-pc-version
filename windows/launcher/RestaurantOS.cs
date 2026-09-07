using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace RestaurantOS.Launcher
{
    static class Program
    {
        private const string HubUrl = "http://127.0.0.1:3000/hub";
        private const string ReadyUrl = "http://127.0.0.1:3000/api/ready";
        private const string ReadyFallbackUrl = "http://localhost:3000/api/ready";
        private const int MaxWaitSeconds = 40;

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();

            bool isServiceMode = false;
            foreach (var arg in args)
            {
                if (arg.Equals("--service", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("--background", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("-s", StringComparison.OrdinalIgnoreCase))
                {
                    isServiceMode = true;
                }
            }

            try
            {
                // 1. Check if the hub is already running and ready
                if (IsHubReadyQuickCheck())
                {
                    if (!isServiceMode)
                    {
                        OpenBrowser(HubUrl);
                    }
                    return;
                }

                // 2. Resolve Application Directory and Paths
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                if (string.IsNullOrEmpty(programData))
                {
                    programData = @"C:\ProgramData";
                }
                string dataDir = Path.Combine(programData, "RestaurantOS");
                string logsDir = Path.Combine(dataDir, "logs");
                string stdoutLog = Path.Combine(logsDir, "hub-stdout.log");
                string stderrLog = Path.Combine(logsDir, "hub-stderr.log");
                string pidFile = Path.Combine(dataDir, "restaurantos.pid");

                try
                {
                    Directory.CreateDirectory(dataDir);
                    Directory.CreateDirectory(Path.Combine(dataDir, "data"));
                    Directory.CreateDirectory(Path.Combine(dataDir, "backups"));
                    Directory.CreateDirectory(Path.Combine(dataDir, "config"));
                    Directory.CreateDirectory(logsDir);
                }
                catch { }

                // 3. AUTOMATIC SELF-HEALING: Check if an instance is running or port 3000 is occupied
                if (IsPortInUse(3000) || IsExistingPidRunning(pidFile))
                {
                    // Give a healthy booting instance up to 3 seconds to answer
                    DateTime waitStart = DateTime.UtcNow;
                    bool isResponding = false;
                    while ((DateTime.UtcNow - waitStart).TotalSeconds < 3)
                    {
                        if (CheckReadyEndpoint())
                        {
                            isResponding = true;
                            break;
                        }
                        Thread.Sleep(400);
                    }

                    if (isResponding)
                    {
                        if (!isServiceMode)
                        {
                            OpenBrowser(HubUrl);
                        }
                        return;
                    }

                    // Not responding after 3 seconds: This is a hung or zombie ghost process!
                    // Execute automatic self-healing immediately so user is never blocked.
                    LogMessage(stdoutLog, "[Self-Healing] Detected unresponsive process locking port 3000. Automatically recovering...");
                    PerformAutoRepair(pidFile, 3000, stdoutLog);
                }

                // 4. Resolve Node.js Runtime
                string nodeExe = Path.Combine(appDir, "runtime", "node.exe");
                if (!File.Exists(nodeExe))
                {
                    nodeExe = Path.Combine(appDir, "node.exe");
                }
                if (!File.Exists(nodeExe))
                {
                    nodeExe = "node.exe";
                }

                string serverScript = Path.Combine(appDir, "server.cjs");
                if (!File.Exists(serverScript))
                {
                    serverScript = Path.Combine(appDir, "server.js");
                }

                // 5. Launch and Poll with Auto-Repair & Retry support
                bool launchSuccessful = false;
                int attempts = 0;

                while (!launchSuccessful && attempts < 3)
                {
                    attempts++;

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = nodeExe,
                        Arguments = string.Format("\"{0}\"", serverScript),
                        WorkingDirectory = appDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };

                    psi.EnvironmentVariables["NODE_ENV"] = "production";
                    psi.EnvironmentVariables["PORT"] = "3000";
                    psi.EnvironmentVariables["RESTAURANTOS_DATA_DIR"] = dataDir;

                    Process process = new Process { StartInfo = psi };

                    process.OutputDataReceived += (s, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                        {
                            LogMessage(stdoutLog, e.Data);
                        }
                    };

                    process.ErrorDataReceived += (s, e) =>
                    {
                        if (!string.IsNullOrEmpty(e.Data))
                        {
                            LogMessage(stderrLog, e.Data);
                        }
                    };

                    bool started = false;
                    try
                    {
                        started = process.Start();
                    }
                    catch (Exception ex)
                    {
                        LogMessage(stderrLog, "Process start failed: " + ex.Message);
                    }

                    if (!started)
                    {
                        DialogResult retry = ShowAutoRepairDialog(
                            "Failed to start the RestaurantOS engine process.\n\n" +
                            "Would you like RestaurantOS to auto-repair and retry?",
                            logsDir
                        );
                        if (retry == DialogResult.Retry)
                        {
                            PerformAutoRepair(pidFile, 3000, stdoutLog);
                            continue;
                        }
                        return;
                    }

                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();

                    // Poll for Readiness
                    DateTime startTime = DateTime.UtcNow;
                    bool isReady = false;

                    while ((DateTime.UtcNow - startTime).TotalSeconds < MaxWaitSeconds)
                    {
                        if (process.HasExited)
                        {
                            string errDetail = GetRecentLogLines(stderrLog, 5);

                            DialogResult retry = ShowAutoRepairDialog(
                                "RestaurantOS could not start.\n\n" +
                                "The local engine exited unexpectedly (a previous background process or port 3000 conflict may have occurred).\n\n" +
                                "Click 'Retry' to automatically terminate conflicting background processes, free port 3000, and restart the engine.\n" +
                                "Click 'Cancel' to exit.\n\n" +
                                (string.IsNullOrEmpty(errDetail) ? "" : "Details:\n" + errDetail + "\n\n"),
                                logsDir
                            );

                            if (retry == DialogResult.Retry)
                            {
                                PerformAutoRepair(pidFile, 3000, stdoutLog);
                                break; // Breaks inner poll loop, triggers outer retry loop
                            }
                            return;
                        }

                        if (CheckReadyEndpoint())
                        {
                            isReady = true;
                            launchSuccessful = true;
                            break;
                        }

                        Thread.Sleep(300);
                    }

                    if (isReady)
                    {
                        break;
                    }

                    // Timed out while process is still running
                    if (!launchSuccessful && !process.HasExited)
                    {
                        try { process.Kill(); } catch { }

                        DialogResult retry = ShowAutoRepairDialog(
                            "RestaurantOS startup timed out.\n\n" +
                            "The server did not respond within the expected timeframe.\n\n" +
                            "Click 'Retry' to auto-repair port bindings and restart.",
                            logsDir
                        );

                        if (retry == DialogResult.Retry)
                        {
                            PerformAutoRepair(pidFile, 3000, stdoutLog);
                            continue;
                        }
                        return;
                    }
                }

                // 6. Open Web Browser once ready
                if (launchSuccessful && !isServiceMode)
                {
                    OpenBrowser(HubUrl);
                }
            }
            catch (Exception ex)
            {
                ShowErrorDialog(
                    "An unexpected error occurred while launching RestaurantOS:\n\n" +
                    ex.Message + "\n\n" +
                    "Diagnostic logs:\nC:\\ProgramData\\RestaurantOS\\logs\\"
                );
            }
        }

        /// <summary>
        /// Automatically terminates orphaned/zombie processes holding port 3000 and deletes stale locks.
        /// </summary>
        private static void PerformAutoRepair(string pidFile, int port, string stdoutLog)
        {
            try
            {
                LogMessage(stdoutLog, "[Auto-Repair] Starting port and process auto-repair...");

                // 1. Terminate process referenced in pidFile if active
                try
                {
                    if (File.Exists(pidFile))
                    {
                        string text = File.ReadAllText(pidFile).Trim();
                        int pid;
                        if (int.TryParse(text, out pid) && pid > 0 && pid != Process.GetCurrentProcess().Id)
                        {
                            try
                            {
                                Process target = Process.GetProcessById(pid);
                                if (target != null && !target.HasExited)
                                {
                                    target.Kill();
                                    target.WaitForExit(1000);
                                    LogMessage(stdoutLog, string.Format("[Auto-Repair] Terminated PID {0} from pidFile", pid));
                                }
                            }
                            catch { }
                        }
                    }
                }
                catch { }

                // 2. Terminate any zombie process listening on the target port via netstat
                KillProcessesListeningOnPort(port, stdoutLog);

                // 3. Clear lockfiles
                try
                {
                    if (File.Exists(pidFile)) File.Delete(pidFile);
                }
                catch { }

                string dataDir = Path.GetDirectoryName(pidFile);
                if (!string.IsNullOrEmpty(dataDir))
                {
                    string lockFile = Path.Combine(dataDir, "restaurantos.lock");
                    try
                    {
                        if (File.Exists(lockFile)) File.Delete(lockFile);
                    }
                    catch { }
                }

                // 4. Wait up to 2 seconds for the socket to fully release
                DateTime waitStart = DateTime.UtcNow;
                while ((DateTime.UtcNow - waitStart).TotalSeconds < 2)
                {
                    if (!IsPortInUse(port)) break;
                    Thread.Sleep(250);
                }

                LogMessage(stdoutLog, "[Auto-Repair] Port 3000 is now free and ready for startup.");
            }
            catch (Exception ex)
            {
                LogMessage(stdoutLog, "[Auto-Repair] Warning during auto-repair: " + ex.Message);
            }
        }

        /// <summary>
        /// Inspects active TCP listening sockets via netstat and kills any process locking the given port.
        /// </summary>
        private static void KillProcessesListeningOnPort(int port, string stdoutLog)
        {
            try
            {
                ProcessStartInfo netstatPsi = new ProcessStartInfo
                {
                    FileName = "netstat",
                    Arguments = "-ano -p tcp",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                using (Process netstatProc = Process.Start(netstatPsi))
                {
                    string output = netstatProc.StandardOutput.ReadToEnd();
                    netstatProc.WaitForExit(2000);

                    string portPattern = ":" + port.ToString();
                    using (StringReader reader = new StringReader(output))
                    {
                        string line;
                        while ((line = reader.ReadLine()) != null)
                        {
                            if (line.Contains(portPattern) && line.Contains("LISTENING"))
                            {
                                string[] parts = line.Trim().Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                if (parts.Length >= 5)
                                {
                                    int pid;
                                    if (int.TryParse(parts[parts.Length - 1], out pid))
                                    {
                                        if (pid > 0 && pid != Process.GetCurrentProcess().Id)
                                        {
                                            try
                                            {
                                                Process victim = Process.GetProcessById(pid);
                                                if (victim != null && !victim.HasExited)
                                                {
                                                    victim.Kill();
                                                    victim.WaitForExit(1000);
                                                    LogMessage(stdoutLog, string.Format("[Auto-Repair] Successfully freed port {0} by terminating zombie PID {1}", port, pid));
                                                }
                                            }
                                            catch { }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private static void LogMessage(string logFile, string message)
        {
            try
            {
                File.AppendAllText(logFile, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}{2}", DateTime.UtcNow, message, Environment.NewLine));
            }
            catch { }
        }

        private static string GetRecentLogLines(string file, int maxLines)
        {
            try
            {
                if (File.Exists(file))
                {
                    string[] lines = File.ReadAllLines(file);
                    if (lines.Length > 0)
                    {
                        int count = Math.Min(lines.Length, maxLines);
                        return string.Join(Environment.NewLine, lines, lines.Length - count, count);
                    }
                }
            }
            catch { }
            return "";
        }

        private static bool ProbeUrl(string url, int timeoutMs)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Proxy = null;
                req.Timeout = timeoutMs;
                req.ReadWriteTimeout = timeoutMs;
                req.Method = "GET";

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    if (resp.StatusCode == HttpStatusCode.OK)
                    {
                        using (Stream stream = resp.GetResponseStream())
                        {
                            if (stream != null)
                            {
                                using (StreamReader reader = new StreamReader(stream))
                                {
                                    string body = reader.ReadToEnd();
                                    return body.Contains("\"ready\":true");
                                }
                            }
                        }
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool IsHubReadyQuickCheck()
        {
            return ProbeUrl(ReadyUrl, 1200) || ProbeUrl(ReadyFallbackUrl, 1200);
        }

        private static bool CheckReadyEndpoint()
        {
            return ProbeUrl(ReadyUrl, 1500) || ProbeUrl(ReadyFallbackUrl, 1500);
        }

        private static bool IsPortInUse(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult ar = client.BeginConnect("127.0.0.1", port, null, null);
                    bool connected = ar.AsyncWaitHandle.WaitOne(400);
                    if (connected && client.Connected)
                    {
                        client.EndConnect(ar);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool IsExistingPidRunning(string pidFile)
        {
            try
            {
                if (!File.Exists(pidFile)) return false;
                string text = File.ReadAllText(pidFile).Trim();
                int pid;
                if (int.TryParse(text, out pid))
                {
                    Process proc = Process.GetProcessById(pid);
                    return proc != null && !proc.HasExited;
                }
            }
            catch { }
            return false;
        }

        private static void OpenBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch
            {
                try
                {
                    Process.Start("explorer.exe", url);
                }
                catch { }
            }
        }

        private static DialogResult ShowAutoRepairDialog(string message, string logsDir)
        {
            return MessageBox.Show(
                message + string.Format("Diagnostic logs:\n{0}\\", logsDir),
                "RestaurantOS Local Hub - Auto-Repair & Troubleshoot",
                MessageBoxButtons.RetryCancel,
                MessageBoxIcon.Warning
            );
        }

        private static void ShowErrorDialog(string message)
        {
            MessageBox.Show(
                message,
                "RestaurantOS Local Hub",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
