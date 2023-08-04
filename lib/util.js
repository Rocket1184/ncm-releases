/**
 * @param {string} msg
 * @param {number} [exitCode=1]
 */
export function panic(msg, exitCode = 1) {
    console.error(new Error(msg));
    process.exit(exitCode);
}
