/**
 * Running a host command as root over SSH.
 *
 * Tried in order: the SSH user is root, passwordless sudo, then Docker. A user in the docker group
 * can already do anything root can (it can start a privileged container), so when sudo needs a
 * password, Optizen runs the command in the host's namespaces through a short-lived privileged
 * container. Every result says which route was used.
 */

export type ElevationRoute = 'root' | 'sudo' | 'docker' | 'none'

/** Small image with busybox nsenter; pulled once on first use. */
export const HOST_HELPER_IMAGE = 'alpine:3.20'

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

/** Prints root, sudo, docker or none. */
export const ELEVATION_PROBE =
  'if [ "$(id -u)" = 0 ]; then echo root; elif sudo -n true 2>/dev/null; then echo sudo; elif command -v docker >/dev/null 2>&1 && docker ps -q >/dev/null 2>&1; then echo docker; else echo none; fi'

export const NO_ROOT_MARKER = '__OPTZ_NO_ROOT'

/**
 * Wrap a POSIX sh script so it runs as root on the host. The route used is printed to stderr as
 * `__OPTZ_ROUTE=<route>`; when no route exists it prints NO_ROOT_MARKER and exits 126.
 */
export function asRoot(script: string): string {
  const quoted = shellEscape(script)
  return [
    `if [ "$(id -u)" = 0 ]; then echo __OPTZ_ROUTE=root >&2; sh -c ${quoted};`,
    `elif sudo -n true 2>/dev/null; then echo __OPTZ_ROUTE=sudo >&2; sudo -n sh -c ${quoted};`,
    `elif command -v docker >/dev/null 2>&1 && docker ps -q >/dev/null 2>&1; then echo __OPTZ_ROUTE=docker >&2; docker run --rm --privileged --pid=host --net=host ${HOST_HELPER_IMAGE} nsenter -t 1 -m -u -n -i -- sh -c ${quoted};`,
    `else echo ${NO_ROOT_MARKER} >&2; exit 126; fi`,
  ].join(' ')
}

export function routeFrom(stderr: string): ElevationRoute {
  const match = /__OPTZ_ROUTE=(root|sudo|docker)/.exec(stderr)
  return (match?.[1] as ElevationRoute | undefined) ?? 'none'
}

/** stderr without the route marker and Docker's image-pull chatter. */
export function cleanStderr(stderr: string): string {
  return stderr
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('__OPTZ_ROUTE=') &&
        !/^(Unable to find image|[0-9a-f]{12}: (Pulling|Pull complete|Waiting|Downloading|Verifying|Download complete|Already exists)|Digest: sha256|Status: Downloaded|.*: Pulling from )/.test(line.trim())
    )
    .join('\n')
    .trim()
}

export function describeRoute(route: ElevationRoute): string {
  if (route === 'docker') return ' (as root through Docker, since sudo needs a password)'
  if (route === 'sudo') return ' (with passwordless sudo)'
  return ''
}

export const NO_ROOT_HELP =
  'This needs root. Connect as root, allow passwordless sudo for the SSH user, or add the SSH user to the docker group.'
