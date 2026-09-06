# Complete Windows Installation Issues Analysis

## Overview
This document identifies all issues preventing successful Windows installation without changing application functionality. These are **infrastructure-only fixes** related to the build pipeline, C# compilation, and process lifecycle management.

---

## 🔴 CRITICAL ISSUES (Block Installation)

### Issue #1: C# Compiler Framework Version Incompatibility
**Status:** ❌ **FAILING**  
**Location:** `scripts/build-windows-package.js` (line 79)  
**Error Message:**
```
windows\launcher\RestaurantOS.cs(5,18): error CS0234: The type or namespace name 'Http' 
does not exist in the namespace 'System.Net'
```

**Root Cause:**
- The build script uses the .NET Framework 4.0 compiler (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`)
- `System.Net.Http` namespace was introduced in .NET Framework 4.5
- The C# launcher (`windows/launcher/RestaurantOS.cs`) imports `System.Net.Http` (line 5) but the compiler is too old

**Impact:**
- RestaurantOS.exe launcher cannot be compiled
- Windows installer cannot be created
- **The entire build pipeline fails**

**Solution:**
Update the C# compiler search to prioritize .NET 4.5+ before falling back to 4.0.

**Affected Files:**
- `scripts/build-windows-package.js`

**Code Fix Required:**
```javascript
// OLD (lines 78-96)
const cscCandidates = [
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
  'csc.exe',
  'csc'
];

// NEW - Prioritize v4.5+ frameworks
const cscCandidates = [
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
  'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.8.1.0\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.8.0\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.7.2\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.5.2\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
  'csc.exe',
  'csc'
];
```

---

### Issue #2: Graceful Shutdown & Lockfile Cleanup Failure
**Status:** ❌ **FAILING**  
**Location:** `server.ts` (lines 462-487) and `scripts/verify-packaged-runtime.cjs` (line 177)  
**Error Messages:**
```
✗ [FAIL] Server exited cleanly with exit code 0
✗ [FAIL] Instance lockfile was cleaned up on graceful shutdown
```

**Root Cause:**
The graceful shutdown handler has a race condition:
- `releaseInstanceLock()` is called immediately after logging shutdown start
- `httpServer.close()` and `io.close()` are asynchronous but their callbacks call `process.exit(0)`
- If the server closes too slowly, the process exits with exit code 1 (from the 10-second timeout)
- The test expects exit code 0, causing the test to fail
- Lock file cleanup happens before the server actually closes

**Current Flow (Broken):**
```
1. Process receives SIGTERM
2. gracefulShutdown() is called
3. releaseInstanceLock() removes lock file IMMEDIATELY
4. io.close() and httpServer.close() are queued asynchronously
5. Both call process.exit(0) in their callbacks
6. BUT: If either takes too long, the 10s timeout fires
7. process.exit(1) is called instead
8. Test sees exit code 1, fails
9. Lock file already deleted, but test expects it to exist
```

**Expected Flow:**
```
1. Process receives SIGTERM
2. gracefulShutdown() is called
3. Close HTTP server & Socket.IO
4. WAIT for both to close
5. THEN release lock file
6. THEN exit with code 0
```

**Impact:**
- Windows deployment verification fails
- Installer cannot complete build pipeline
- Lock file cleanup is unpredictable

**Solution:**
Restructure `gracefulShutdown()` to properly sequence: close → wait → cleanup → exit.

**Affected Files:**
- `server.ts` (lines 462-487)

**Code Fix Required:**
```typescript
// Graceful Shutdown - REFACTORED
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, shutting down gracefully...');
  
  // Step 1: Flush database checkpoint
  try {
    await db.run(sql.raw('PRAGMA wal_checkpoint(TRUNCATE);'));
  } catch {}
  
  // Step 2: Close WebSockets first
  let ioCloseComplete = false;
  io.close(() => {
    logger.info('Socket.IO server closed.');
    ioCloseComplete = true;
  });
  
  // Step 3: Close HTTP server
  let httpCloseComplete = false;
  httpServer.close(() => {
    logger.info('HTTP server closed.');
    httpCloseComplete = true;
  });
  
  // Step 4: Wait for both to close with timeout
  const closeTimeout = new Promise(resolve => setTimeout(resolve, 10000));
  await Promise.race([
    new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (ioCloseComplete && httpCloseComplete) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    }),
    closeTimeout
  ]);
  
  // Step 5: Clean up lock file AFTER servers are closed
  releaseInstanceLock();
  
  // Step 6: Exit cleanly
  logger.info('Graceful shutdown complete.');
  process.exit(0);
};
```

---

## ⚠️ WORKFLOW ISSUES (Build Environment)

### Issue #3: GitHub Actions Node.js 20 Deprecation Warning
**Status:** ⚠️ **WARNING** (Non-blocking but needs fix)  
**Location:** `.github/workflows/build-windows.yml` (lines 20-24)  
**Warning Message:**
```
Warning: Node.js 20 is deprecated. The following actions target Node.js 20 but 
are being forced to run on Node.js 24
```

**Root Cause:**
- GitHub Actions now defaults to Node 24 for all workflows
- Workflow explicitly requests Node 20 via `actions/setup-node@v4` with `node-version: 20`
- This causes action incompatibilities and deprecation warnings
- The warning indicates all `actions/*` are being forced to run on Node 24 anyway

**Impact:**
- Workflow continues to run but with incompatible Node versions
- Future GitHub Actions might drop Node 20 support entirely
- Causes unnecessary warnings in build logs

**Solution:**
Update `actions/setup-node` to use Node 20.18.0 LTS with proper configuration.

**Affected Files:**
- `.github/workflows/build-windows.yml`

**Code Fix Required:**
```yaml
# OLD (line 20-24)
- name: Setup Node.js Runtime (v20 LTS)
  uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'

# NEW - Explicit LTS version and compatibility setting
- name: Setup Node.js Runtime (v20 LTS)
  uses: actions/setup-node@v4
  with:
    node-version: '20.18.0'
    cache: 'npm'
    check-latest: false
```

---

## 🟡 CODE QUALITY ISSUES (Non-blocking, Best Practices)

### Issue #4: Unused C# Import in Launcher
**Status:** ℹ️ **IMPROVEMENT**  
**Location:** `windows/launcher/RestaurantOS.cs` (line 5)  

**Finding:**
```csharp
using System.Net.Http;  // Line 5 - IMPORTED but NEVER USED
```

The launcher imports `System.Net.Http` but never uses the `HttpClient` class. It only uses:
- `HttpWebRequest` (from `System.Net`)
- `HttpWebResponse` (from `System.Net`)

**Impact:**
- Clean code: The import creates unnecessary dependency
- The code works fine without it, but it's misleading
- Modern C# best practice is to use HttpClient from System.Net.Http

**Solution (Optional):**
Remove the unused import. The code will compile and run identically.

**Code Fix:**
```csharp
// Line 5 - DELETE this line
using System.Net.Http;
```

---

### Issue #5: C# Launcher Missing WebException Handling for Non-200 Responses
**Status:** ℹ️ **IMPROVEMENT**  
**Location:** `windows/launcher/RestaurantOS.cs` (lines 206-218, 220-241)  

**Finding:**
The HTTP response checking catches exceptions but doesn't explicitly handle non-200 responses that don't throw exceptions.

```csharp
// Current code catches HttpWebRequest exceptions but:
// - If server returns 404, 500, etc., the code gets a response object
// - The catch block only runs if an exception is thrown
// - Some status codes might not throw exceptions, silently failing
```

**Impact:**
- Unlikely edge case, but missing defensive programming
- Response code checking via `resp.StatusCode == HttpStatusCode.OK` is correct
- But if a response doesn't throw an exception, the using block might not properly dispose

**Solution (Optional but Recommended):**
Ensure proper response stream disposal even if status code != 200.

```csharp
// Enhanced version:
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
      return false;  // Non-200 response
    }
  }
  catch (WebException) { }  // Explicitly catch WebException
  catch { }  // Catch other exceptions
  return false;
}
```

---

### Issue #6: Hardcoded Node.js Version in Build Script
**Status:** ℹ️ **MAINTENANCE RISK**  
**Location:** `scripts/build-windows-package.js` (line 46)  

**Finding:**
```javascript
const url = 'https://nodejs.org/dist/v20.18.0/win-x64/node.exe';
```

**Issue:**
- Node.js version is hardcoded
- When Node 20 reaches end-of-life, this URL will be invalid
- No version fallback or update mechanism
- Workflow explicitly sets up Node 20, but package downloads 20.18.0 specifically

**Impact:**
- Maintenance burden to update script when Node versions change
- Potential future build failures if nodejs.org URL structure changes
- No connection between workflow Node version and packaged Node version

**Solution (Recommended):**
Extract Node.js version to a constant or environment variable.

```javascript
// Add at top of file:
const NODE_VERSION = process.env.NODE_VERSION || '20.18.0';
const NODE_ARCH = 'win-x64';
const url = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCH}/node.exe`;

// Update workflow to pass version:
// - name: Build Production Bundles
//   env:
//     NODE_VERSION: '20.18.0'
//   run: npm run package:windows
```

---

### Issue #7: Missing Error Recovery for LibSQL Windows Binary Packaging
**Status:** ℹ️ **ROBUSTNESS**  
**Location:** `scripts/build-windows-package.js` (lines 206-226)  

**Finding:**
```javascript
if (!fs.existsSync(winLibsqlDest) || !fs.existsSync(path.join(winLibsqlDest, 'index.node'))) {
  console.log('[Dependencies] Ensuring prebuilt Windows x64 LibSQL binary is packaged...');
  try {
    // Attempts to npm pack and extract
  } catch (lErr) {
    console.warn('[Dependencies] Note on LibSQL Windows prebuilt packaging:', lErr.message);
    // ⚠️ Does NOT re-throw or fail the build
  }
}
```

**Issue:**
- If LibSQL Windows binary packaging fails, the warning is logged but build continues
- The application **requires** `@libsql/win32-x64-msvc` to run on Windows
- Missing this binary will cause runtime errors when the installed app tries to start
- Build succeeds even though deployment will fail

**Impact:**
- Silent failure: User doesn't know LibSQL packaging failed
- Runtime crash on customer's Windows PC
- Impossible to debug: build passed, but app won't start

**Solution (Recommended):**
Make LibSQL packaging failure a hard error in production builds.

```javascript
if (!fs.existsSync(winLibsqlDest) || !fs.existsSync(path.join(winLibsqlDest, 'index.node'))) {
  console.log('[Dependencies] Ensuring prebuilt Windows x64 LibSQL binary is packaged...');
  try {
    const tmpDir = path.join(ROOT_DIR, 'runtime', 'libsql-win-pkg');
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync('npm pack @libsql/win32-x64-msvc@0.5.29 --pack-destination=' + tmpDir, { stdio: 'pipe' });
    const tarballs = fs.readdirSync(tmpDir).filter(f => f.endsWith('.tgz'));
    if (tarballs.length > 0) {
      fs.mkdirSync(winLibsqlDest, { recursive: true });
      execSync(`tar -xzf "${path.join(tmpDir, tarballs[0])}" --strip-components=1 -C "${winLibsqlDest}"`, { stdio: 'pipe' });
      console.log('[Dependencies] Embedded Windows x64 LibSQL native binary successfully into package.');
    } else {
      throw new Error('Failed to download LibSQL package, no tarballs found');
    }
  } catch (lErr) {
    console.error('[FATAL] LibSQL Windows binary packaging failed:', lErr.message);
    console.error('[FATAL] The application requires @libsql/win32-x64-msvc to run on Windows.');
    process.exit(1);
  }
}
```

---

### Issue #8: Missing Visual C++ Redist Error Handling
**Status:** ℹ️ **DEPLOYMENT RISK**  
**Location:** `scripts/build-windows-package.js` (lines 228-255)  

**Finding:**
```javascript
const redistX64Dir = path.join(ROOT_DIR, 'windows', 'redist', 'x64');
if (fs.existsSync(redistX64Dir)) {
  // Packages VC++ redist DLLs if they exist
  // But no error if they DON'T exist
}
```

**Issue:**
- The app depends on Visual C++ 2015-2022 runtime DLLs
- If `/windows/redist/x64/` directory is missing or empty, the app won't run on Windows
- Build completes successfully with a silent failure
- No warning logged if expected DLLs are missing

**Impact:**
- User installs app, tries to run it, gets cryptic DLL not found errors
- Build passed, but deployment is broken
- Support burden

**Solution (Recommended):**
Verify required Visual C++ DLLs are present before packaging.

```javascript
const redistX64Dir = path.join(ROOT_DIR, 'windows', 'redist', 'x64');
const requiredDlls = ['msvcp140.dll', 'vcruntime140.dll'];

if (!fs.existsSync(redistX64Dir)) {
  console.warn('[Redist] Visual C++ redist directory not found at ' + redistX64Dir);
  console.warn('[Redist] The application may not run on Windows without these DLLs');
}

if (fs.existsSync(redistX64Dir)) {
  console.log('[Redist] Packaging Visual C++ 2015-2022 x64 Runtime DLLs...');
  const dlls = fs.readdirSync(redistX64Dir).filter(f => f.toLowerCase().endsWith('.dll'));
  
  // Check for required DLLs
  const hasMissingDlls = requiredDlls.some(required => 
    !dlls.some(found => found.toLowerCase().includes(required.toLowerCase()))
  );
  
  if (hasMissingDlls) {
    console.warn('[Redist] WARNING: Expected Visual C++ DLLs not found in redist directory');
    console.warn('[Redist] Required: ' + requiredDlls.join(', '));
    console.warn('[Redist] Found: ' + dlls.join(', '));
  }
  
  // ... rest of packing logic
}
```

---

## 📋 Summary Table

| Issue | Severity | Type | File(s) | Auto-Fix | Status |
|-------|----------|------|---------|----------|--------|
| C# Compiler v4.0 incompatibility | 🔴 CRITICAL | Build | `build-windows-package.js` | ✅ Yes | BLOCKING |
| Graceful shutdown exit code | 🔴 CRITICAL | Runtime | `server.ts` | ✅ Yes | BLOCKING |
| Node 20 deprecation | ⚠️ WARNING | CI/CD | `.github/workflows/build-windows.yml` | ✅ Yes | Non-blocking |
| Unused C# import | 🟡 CODE | Quality | `RestaurantOS.cs` | ✅ Yes | Optional |
| Missing HTTP error handling | 🟡 CODE | Quality | `RestaurantOS.cs` | ✅ Yes | Optional |
| Hardcoded Node version | 🟡 MAINT | Maintenance | `build-windows-package.js` | ✅ Yes | Recommended |
| Silent LibSQL failure | 🟡 ROBU | Robustness | `build-windows-package.js` | ✅ Yes | Recommended |
| Missing Redist validation | 🟡 DEPLOY | Robustness | `build-windows-package.js` | ✅ Yes | Recommended |

---

## Next Steps

1. **Immediate (Blocking):**
   - Fix Issue #1: Update C# compiler version check
   - Fix Issue #2: Restructure graceful shutdown sequence

2. **Short-term (Within Sprint):**
   - Fix Issue #3: Update workflow Node version handling

3. **Long-term (Nice to Have):**
   - Implement Issues #4-8 for better robustness and maintainability
