using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace RestaurantOS.Launcher
{
    static class Program
    {
        private const string HubUrl = "http://localhost:3000/hub";
        private const string ReadyUrl = "http://localhost:3000/api/ready";
        private const int MaxWaitSeconds = 35;

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleRenderingDefault(false);

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

                try
                {
                    Directory.CreateDirectory(dataDir);
                    Directory.CreateDirectory(Path.Combine(dataDir, "data"));
                    Directory.CreateDirectory(Path.Combine(dataDir, "backups"));
                    Directory.CreateDirectory(Path.Combine(dataDir, "config"));
                    Directory.CreateDirectory(logsDir);
                }
                catch { }

                // 3. Resolve Node.js Runtime
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

                // 4. Configure Process Start Info
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{serverScript}\"",
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
                        try { File.AppendAllText(stdoutLog, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {e.Data}{Environment.NewLine}"); } catch { }
                    }
                };

                process.ErrorDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        try { File.AppendAllText(stderrLog, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {e.Data}{Environment.NewLine}"); } catch { }
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

                // 5. Poll for Readiness
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
                            $"Diagnostic logs:\n{logsDir}\\"
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
                    ShowErrorDialog(
                        "RestaurantOS startup timed out.\n\n" +
                        "The server did not respond within the expected timeframe.\n" +
                        "Please verify system resources or restart your computer.\n\n" +
                        $"Diagnostic logs:\n{logsDir}\\"
                    );
                    return;
                }

                // 6. Open Web Browser once ready
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

        private static bool IsHubReadyQuickCheck()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(ReadyUrl);
                req.Timeout = 1200;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool CheckReadyEndpoint()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(ReadyUrl);
                req.Timeout = 1000;
                req.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    if (resp.StatusCode == HttpStatusCode.OK)
                    {
                        using (var reader = new StreamReader(resp.GetResponseStream()))
                        {
                            string body = reader.ReadToEnd();
                            return body.Contains("\"ready\":true");
                        }
                    }
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
