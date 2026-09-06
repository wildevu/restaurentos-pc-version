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

                // 3. Prevent Port 3000 Conflict: Check if an instance is already starting or running
                if (IsPortInUse(3000) || IsExistingPidRunning(pidFile))
                {
                    // Wait up to 12 seconds for the existing instance to finish booting
                    DateTime waitStart = DateTime.UtcNow;
                    while ((DateTime.UtcNow - waitStart).TotalSeconds < 12)
                    {
                        if (CheckReadyEndpoint())
                        {
                            if (!isServiceMode)
                            {
                                OpenBrowser(HubUrl);
                            }
                            return;
                        }
                        Thread.Sleep(500);
                    }

                    // If it is responding now, open browser
                    if (CheckReadyEndpoint())
                    {
                        if (!isServiceMode)
                        {
                            OpenBrowser(HubUrl);
                        }
                        return;
                    }
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

                // 5. Configure Process Start Info
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

                // Redirect logs asynchronously
                process.OutputDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        try { File.AppendAllText(stdoutLog, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}{2}", DateTime.UtcNow, e.Data, Environment.NewLine)); } catch { }
                    }
                };

                process.ErrorDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        try { File.AppendAllText(stderrLog, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}{2}", DateTime.UtcNow, e.Data, Environment.NewLine)); } catch { }
                    }
                };

                bool started = process.Start();
                if (!started)
                {
                    ShowErrorDialog("Failed to start the RestaurantOS engine process.");
                    return;
                }

                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

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
                            if (File.Exists(stderrLog))
                            {
                                string[] lines = File.ReadAllLines(stderrLog);
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
                    // Clean up child process to avoid leaving an orphaned zombie locking port 3000
                    try
                    {
                        if (process != null && !process.HasExited)
                        {
                            process.Kill();
                        }
                    }
                    catch { }

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
