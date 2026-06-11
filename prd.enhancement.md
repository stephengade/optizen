**Phase A: Trustworthy Core**
Goal: make Launchpad feel safe, understandable, and reliable.

1. Product clarity pass
   * tighten terminology across the app
   * clearly separate:
     * servers
     * projects/apps
     * deploys
     * infra files
   * reduce confusing labels and mixed responsibilities in pages
2. Safer operations
   * confirmation modals for risky actions
   * command preview before deploy
   * clearer rollback summary before executing
   * destructive-action recheck UX
3. Better feedback
   * actionable error messages
   * success/failure states that explain what happened
   * better loading, empty, and retry states
4. Project classification cleanup
   * improve imported app labeling
   * distinguish:
     * manual
     * imported
     * compose-based
     * image-based
     * proxy app
   * show this clearly in UI
5. Health summaries
   * last deploy result on project cards
   * current project/container health summary
   * quick server health snapshot

**Phase B: Powerful Operations**
Goal: make the tool genuinely useful for day-to-day VPS operations.

1. Richer observability
   * CPU
   * uptime
   * load average
   * disk inode pressure
   * container status on server overview
   * recent deploy outcomes per server
2. Project health checks
   * configure health endpoint or port check
   * store last successful heartbeat
   * show healthy/degraded/down state
3. Activity timeline
   * recent deploys
   * env edits
   * proxy edits
   * secret changes
   * imports
   * rollback actions
4. Stronger file management
   * file browser for env/proxy/config files
   * suggested related files from imported projects
   * diff before save
   * backup before overwrite
   * validation before write
   * version history for env/proxy changes
5. Better log experience
   * beyond deploy logs
   * basic remote log tailing for project/app logs
   * recent log snapshots

**Phase C: Polished Product**
Goal: make it portfolio-worthy visually and experientially.

1. Dashboard redesign
   * stronger hierarchy
   * better stat layout
   * clearer density and spacing
   * more intentional cards and sections
2. Consistent masking/reveal UX
   * all secrets and sensitive fields use same reveal/copy pattern
   * demo mode clearly applied everywhere
3. Command palette / quick actions
   * jump to server/project
   * test SSH
   * deploy
   * open env/proxy
   * import app
4. Seeded demo mode
   * sample servers
   * sample projects
   * sample deploy history
   * safe fake telemetry/logs for screenshots and demos
5. Accessibility and responsiveness
   * keyboard-friendly modals
   * better mobile/tablet layouts
   * focus states and navigation polish

**Phase D: Security and Credibility**
Goal: make the product feel mature and technically serious.

1. Session/security controls
   * session duration controls
   * optional re-auth for destructive actions
   * permission separation between edit and execute actions
2. Secret/audit visibility
   * audit trail for secret reveals and key changes
   * secret access events
   * change history for env/proxy/deploy config
3. Testing
   * route tests for SSH/resource/proxy/import logic
   * component tests for masking/reveal and destructive flows
   * regression coverage for core routes
4. Engineering polish
   * background polling strategy
   * error boundaries
   * architecture docs
   * tradeoff notes
   * seeded fixtures for local/demo use

**Recommended order**
If you want the highest-value order:

1. Phase A
2. Phase B items:
   * richer observability
   * file browser
   * project health checks
   * activity timeline
3. Phase C
4. Phase D

**Best next milestone**
If you want the single best next milestone before the GitHub bootstrap idea:

`Trust + Observability milestone`

Include:

* health summaries
* better destructive-action UX
* clearer errors
* classification cleanup
* CPU/load/uptime/inodes/container health
* activity timeline
