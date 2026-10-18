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
        private const string HubUrl = "http://127.0.0.1:8989/hub";
        private const string ReadyUrl = "http://127.0.0.1:8989/api/ready";
        private const string ReadyFallbackUrl = "http://localhost:8989/api/ready";
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
                string supervisorLog = Path.Combine(logsDir, "hub-supervisor.log");
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

                // 3. Prevent duplicate hub instances. Never kill a process based only on a
                // port probe or PID file: database migrations may legitimately take time.
                if (IsPortInUse(8989) || IsExistingPidRunning(pidFile))
                {
                    DateTime waitStart = DateTime.UtcNow;
                    while ((DateTime.UtcNow - waitStart).TotalSeconds < MaxWaitSeconds)
                    {
                        if (CheckReadyEndpoint())
                        {
                            if (!isServiceMode) OpenBrowser(HubUrl);
                            return;
                        }
                        Thread.Sleep(400);
                    }

                    ShowErrorDialog(
                        "RestaurantOS is already starting or a process is occupying port 8989, but the hub did not become ready within " +
                        MaxWaitSeconds + " seconds. No existing process was terminated.\n\n" +
                        "Check diagnostic logs before restarting the hub.\n\n" +
                        "Diagnostic logs:\nC:\\ProgramData\\RestaurantOS\\logs\\"
                    );
                    return;
                }

                // 4. Start the persistent supervisor rather than a Node process with
                // redirected stdout/stderr pipes tied to this short-lived GUI launcher.
                string supervisorScript = Path.Combine(appDir, "windows", "service", "run-hub-supervisor.ps1");
                if (!File.Exists(supervisorScript))
                {
                    ShowErrorDialog(
                        "The RestaurantOS hub supervisor is missing. Please reinstall RestaurantOS.\n\n" +
                        "Expected file:\n" + supervisorScript
                    );
                    return;
                }

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = string.Format(
                        "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{0}\" -AppDir \"{1}\" -DataDir \"{2}\"",
                        supervisorScript, appDir, dataDir),
                    WorkingDirectory = appDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    RedirectStandardOutput = false,
                    RedirectStandardError = false
                };

                Process process = new Process { StartInfo = psi };
                bool started = process.Start();
                if (!started)
                {
                    ShowErrorDialog("Failed to start the RestaurantOS hub supervisor.");
                    return;
                }

                // 6. Poll for Readiness
                DateTime startTime = DateTime.UtcNow;
                bool isReady = false;

                while ((DateTime.UtcNow - startTime).TotalSeconds < MaxWaitSeconds)
                {
                    if (process.HasExited)
                    {
                        string errDetail = "";
                        try
                        {
                            if (File.Exists(supervisorLog))
                            {
                                string[] lines = File.ReadAllLines(supervisorLog);
                                if (lines.Length > 0)
                                {
                                    int count = Math.Min(lines.Length, 5);
                                    errDetail = string.Join(Environment.NewLine, lines, lines.Length - count, count);
                                }
                            }
                        }
                        catch { }

                        ShowErrorDialog(
                            "RestaurantOS could not start.\n\n" +
                            "The local database engine or server could not be initialized.\n" +
                            "Please restart RestaurantOS. If the problem continues, contact support.\n\n" +
                            (string.IsNullOrEmpty(errDetail) ? "" : "Details:\n" + errDetail + "\n\n") +
                            string.Format("Diagnostic logs:\n{0}\\", logsDir)
                        );
                        return;
                    }

                    if (CheckReadyEndpoint())
                    {
                        isReady = true;
                        break;
                    }

                    Thread.Sleep(300);
                }

                if (!isReady)
                {
                    // A startup timeout is not proof the server is dead. It may still be migrating,
                    // so do not terminate it or risk interrupting database recovery.
                    ShowErrorDialog(
                        "RestaurantOS startup timed out.\n\n" +
                        "The server did not respond within the expected timeframe.\n" +
                        "Please verify system resources or restart your computer.\n\n" +
                        string.Format("Diagnostic logs:\n{0}\\", logsDir)
                    );
                    return;
                }

                // 7. Open Web Browser once ready
                if (!isServiceMode)
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

        private static bool ProbeUrl(string url, int timeoutMs)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                // CRITICAL ON WINDOWS: Bypasses WPAD proxy auto-detection which blocks for 2-5 seconds
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
            catch (WebException ex)
            {
                if (ex.Response != null)
                {
                    try { ex.Response.Close(); } catch { }
                }
                return false;
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

        private static void KillOrphanedServerProcesses()
        {
            try
            {
                string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                if (string.IsNullOrEmpty(programData)) programData = @"C:\ProgramData";
                string pidFile = Path.Combine(programData, "RestaurantOS", "restaurantos.pid");

                if (File.Exists(pidFile))
                {
                    string text = File.ReadAllText(pidFile).Trim();
                    int pid;
                    if (int.TryParse(text, out pid))
                    {
                        try
                        {
                            Process proc = Process.GetProcessById(pid);
                            if (proc != null && !proc.HasExited)
                            {
                                proc.Kill();
                                proc.WaitForExit(1000);
                            }
                        }
                        catch { }
                    }
                    try { File.Delete(pidFile); } catch { }
                }

            }
            catch { }
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
