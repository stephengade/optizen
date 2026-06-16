# Contributing to Optizen

Thank you for helping to improve Optizen! This guide outlines our development workflow and expectations for contributions.

---

## Contribution Principles

Before writing any code, please keep our core tenets in mind:

1. **Focused Scope:** Keep changes intentional and easy to review. Prefer small, highly targeted improvements over broad, unrelated edits.
2. **Preserve Operational Safety:** Deploys, SSH operations, and reverse proxy updates are risky. Test critical code paths carefully.
3. **Clear Operations Model:** Write code that makes it easy for the next operator or developer to understand how the system is behaving.
4. **No Unneeded Dependencies:** Keep the application lean. Avoid adding npm modules unless there is a strong architectural need.

---

## Development Workflow

### 1. Fork and Clone the Repository
Start by forking the project on GitHub, then clone your fork locally:
```bash
git clone https://github.com/<your-username>/optizen.git
cd optizen
```

### 2. Create a Focused Branch
Choose a descriptive branch name reflecting your task:
```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-name
```

### 3. Run the Application Locally
Make sure you have [Bun](https://bun.sh) (>= 1.3) installed. Run the following commands to install dependencies and boot both the client and server services in development mode:
```bash
bun install
bun dev
```
By default:
- The Next.js frontend runs at `http://localhost:3000`
- The Elysia backend runs at `http://localhost:3001` (all `/api/*` frontend calls are rewrote automatically)

### 4. Make the Smallest Complete Change
Implement your fix or feature. Keep code changes clean, respect the Tailwind CSS v4 variables system (`apps/web/app/globals.css`), and keep formatting consistent. Do not bundle unrelated cleanups or refactors.

### 5. Type-Check and Verify
Ensure all TypeScript definitions and configurations build without errors:
```bash
bun run type-check
```
Verify the feature manually in the browser. Test empty states, loading indicator states, and verify mobile responsiveness.

### 6. Commit and Push
Ensure your commit message is clean and structured (following conventional commits prefix style):
```bash
git add .
git commit -m "feat: short description of your feature"
git push origin your-branch-name
```

---

## Pull Request Checklist

When opening a Pull Request, please provide a clear description containing:
- **Problem:** What user or operator problem does this change solve?
- **Solution:** How does this commit resolve it?
- **Verification:** What steps did you take to test this change locally? (Include screenshots/videos for UI work).
- **Risks:** Are there any security, data persistence, or breaking changes reviewers should be aware of?
