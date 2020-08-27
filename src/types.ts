import { EventEmitter } from 'events'

export type ScopeStr = 'device' | 'local' | 'private' | 'public';

export type Incoming = {
  scope: ScopeStr | Array<ScopeStr>;
  transform: 'shs' | 'noauth';
  port?: number;
  host?: string;
};

export type Outgoing = {
  scope?: undefined;
  transform: 'shs' | 'noauth';
  port?: undefined;
  host?: undefined;
};

export type Transport = {
  name: string;
  create: (opts: Incoming | Outgoing) => any;
};

export type Transform = {
  name: string;
  create: () => unknown;
};

export type Config = {
  // Cryptographic capability key
  caps?: {
    shs?: Buffer | string;
  };
  appKey?: Buffer | string;

  // Cryptographic keys
  keys?: {
    public?: string;
    private?: string;
    id?: string;
  };
  seed?: unknown;

  // Multiserver
  connections?: {
    incoming?: {
      [name: string]: Array<Incoming>;
    };
    outgoing?: {
      [name: string]: Array<Outgoing>;
    };
  };

  // Timers
  timeout?: number;
  timers?: {
    handshake?: number;
    inactivity?: number;
  };

  // Legacy but still supported
  host?: string;
  port?: number;
};

export type MuxRPCType = 'sync' | 'async' | 'source' | 'sink' | 'duplex';

export type RPC = EventEmitter & {
  close(...args: Array<unknown>): void;
  id?: string;
  meta?: unknown;
  stream: {address?: string};
}

export type Manifest = Record<string, MuxRPCType | Record<string, MuxRPCType>>;

export type PP<N extends string> = {
  name: N;
  init: (api: any, opts: any, permissions: any, manifest: any) => any;
}

export type Plugin<N extends string | null = null, T = any> = {
  init: (api: any, opts: any, permissions: any, manifest: any) => T;
  manifest?: Manifest;
  permissions?: {
    allow?: Array<string>;
    deny?: Array<string>;
  };
  name?: N;
  version?: string;
};

type AnyFunction = (...args: Array<any>) => any;

/**
 * Convert every manifest field (in `M`) to a function, max 2 levels nested.
 */
export type APIFromManifest<M extends Manifest> = {
  [k1 in keyof M]: M[k1] extends string
    ? AnyFunction
    : {
        [k2 in keyof M[k1]]: M[k1][k2] extends string
          ? AnyFunction
          : {[k3 in keyof M[k1][k2]]: AnyFunction};
      };
};

export type CreateAndPlugin<
  M extends Manifest,
  N extends string | null,
  T
> = Create<
  // Accumulate everything from the previous manifest
  M &
    // And include...
    (N extends string // The plugin's manifest nested by its name (if it had a valid name)
      ? {
          [Name in N]: {
            [P in keyof T]: string;
          };
        } // Else, the plugin's manifest not nested
      : {
          [P in keyof T]: string;
        })
>;

export interface Create<M extends Manifest> {
  (opts: any): APIFromManifest<M>;
  use<N extends string | null, T>(
    plugin: Plugin<N, T>,
  ): CreateAndPlugin<M, N, T>;
  use(plugin: unknown): Create<M>;
  plugins: Array<Plugin>;
  manifest: Manifest;
  permissions: Record<string, unknown>;
}
