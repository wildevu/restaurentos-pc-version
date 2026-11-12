declare module 'multicast-dns' {
  interface MulticastDnsOptions {
    interface?: string;
    ip?: string;
    port?: number;
    ttl?: number;
    reuseAddr?: boolean;
    loopback?: boolean;
    multicast?: boolean;
    type?: 'udp4' | 'udp6';
  }

  interface MulticastDnsClient {
    on(event: 'ready', listener: () => void): this;
    on(event: 'query', listener: (query: { questions?: Array<{ name: string; type: string | number }> }) => void): this;
    on(event: 'error' | 'warning', listener: (error: Error) => void): this;
    respond(packet: { answers: Array<{ name: string; type: string; class?: string; ttl?: number; flush?: boolean; data: string }> }, callback?: (error?: Error | null) => void): void;
    destroy(callback?: () => void): void;
  }

  export default function multicastDns(options?: MulticastDnsOptions): MulticastDnsClient;
}
