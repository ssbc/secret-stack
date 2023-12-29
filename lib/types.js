/**
 * @typedef {'device' | 'local' | 'private' | 'public'} ScopeStr
 *
 * @typedef {{
 *   scope: ScopeStr | Array<ScopeStr>,
 *   transform: 'shs' | 'noauth',
 *   port?: number,
 *   host?: string,
 * }} Incoming
 *
 * @typedef {{
 *   scope?: undefined,
 *   transform: 'shs' | 'noauth',
 *   port?: undefined,
 *   host?: undefined,
 * }} Outgoing
 *
 * @typedef {{
 *   name: string,
 *   create: (opts: Incoming | Outgoing) => any,
 * }} Transport
 *
 * @typedef {{
 *   name: string,
 *   create: () => unknown,
 *   identify?: (publicKey: Buffer) => any,
 * }} Transform
 *
 * @typedef {{
 *   global: {
 *     caps?: {
 *       shs?: Buffer | string;
 *     };
 *     appKey?: Buffer | string;
 *     keys?: {
 *       public?: string;
 *       private?: string;
 *       id?: string;
 *     };
 *     seed?: unknown;
 *     host?: string;
 *     port?: number;
 *     connections?: {
 *       incoming?: {
 *         [name: string]: Array<Incoming>;
 *       };
 *       outgoing?: {
 *         [name: string]: Array<Outgoing>;
 *       };
 *     };
 *     timeout?: number;
 *     timers?: {
 *       handshake?: number;
 *       inactivity?: number;
 *     };
 *   }
 * }} Config
 */
