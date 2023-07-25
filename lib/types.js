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
 * }} Transform
 *
 * @typedef {{
 *   caps?: {
 *     shs?: Buffer | string;
 *   };
 *   appKey?: Buffer | string;
 *   keys?: {
 *     public?: string;
 *     private?: string;
 *     id?: string;
 *   };
 *   seed?: unknown;
 *   connections?: {
 *     incoming?: {
 *       [name: string]: Array<Incoming>;
 *     };
 *     outgoing?: {
 *       [name: string]: Array<Outgoing>;
 *     };
 *   };
 *   timeout?: number;
 *   timers?: {
 *     handshake?: number;
 *     inactivity?: number;
 *   };
 *   host?: string;
 *   port?: number;
 * }} Config
 */
