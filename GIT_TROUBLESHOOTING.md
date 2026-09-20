# Git Clone & Proxy Configuration Troubleshooting Guide

## Overview

If a session or environment setup fails during the repository cloning phase with an error like:

```text
git config --global --add url.http://git@192.168.0.1:8080/.insteadOf https://github.com/
git config --global --add url.http://git@192.168.0.1:8080/.insteadOf git@github.com:
git clone --depth 1 --shallow-submodules --no-single-branch --recursive https://github.com/wildevu/restaurentos-pc-version -b main /app
Cloning into '/app'...
fatal: could not read Password for 'http://git@192.168.0.1:8080': No such device or address
```

This guide explains the root cause, how to fix it, and how to resume work.

---

## Root Cause Analysis

1. **`insteadOf` URL Rewriting**:
   The runner's startup script injected global Git configuration rules into `~/.gitconfig`:
   - `url.http://git@192.168.0.1:8080/.insteadOf https://github.com/`
   - `url.http://git@192.168.0.1:8080/.insteadOf git@github.com:`

2. **Interactive Password Prompt Failure**:
   When Git attempts to clone `https://github.com/...`, the rule rewrites the destination URL to `http://git@192.168.0.1:8080`.
   Because `http://git@...` specifies user `git` without an embedded password, Git attempts to open an interactive terminal prompt asking for a password. Because setup scripts run in non-interactive batch mode (without a TTY terminal), Git aborts with `fatal: could not read Password ...: No such device or address`.

3. **Session Startup Crash Loop**:
   In automated agent environments, the workspace setup script runs prior to agent execution on every turn. If `git clone` fails, the turn fails immediately before the AI agent process can start, preventing the agent from modifying the container state.

---

## Step-by-Step Resolution

### 1. For Stuck Sessions on Jules / Automated Platforms
- **Action**: Start a **New Session** pointing to the repository/branch.
- **Why**: Fresh sessions initialize a clean container with updated environment settings (using standard HTTPS/OAuth or fixed proxy endpoints like `url.https://github.com/.insteadof=https://github.com/`), bypassing the broken proxy URL.

### 2. For Local Machines, Self-Hosted Runners, or CI Containers
If your local or CI environment has stale or broken `insteadOf` entries in global Git config, run:

```bash
# Check current global git config
git config --global --list --show-origin

# Remove the invalid insteadOf rules
git config --global --unset-all url.http://git@192.168.0.1:8080/.insteadOf

# Confirm git clone works cleanly
git clone https://github.com/wildevu/restaurentos-pc-version
```

### 3. Verification
Verify your global configuration no longer redirects to an unauthenticated proxy:
```bash
git config --global --get-regexp '^url\.'
```
If clean, cloning via HTTPS or SSH will function without interactive password failures.
