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
