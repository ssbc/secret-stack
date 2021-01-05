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
