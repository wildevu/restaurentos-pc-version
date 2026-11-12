import multicastDns from 'multicast-dns';

export const LOCAL_HUB_HOSTNAME = 'restos.local';
const MDNS_MULTICAST_ADDRESS = '224.0.0.251';
const MDNS_PORT = 5353;
const RECORD_TTL_SECONDS = 30;

export interface LocalHostnameStatus {
  state: 'stopped' | 'waiting-for-network' | 'starting' | 'published' | 'error';
  hostname: string;
  address: string | null;
  lastError: string | null;
}

interface MdnsQuestion {
  name: string;
  type: string | number;
}

interface MdnsQuery {
  questions?: MdnsQuestion[];
}

interface MdnsRecord {
  name: string;
  type: 'A';
  class: 'IN';
  ttl: number;
  flush: true;
  data: string;
}

interface MdnsClient {
  on(event: 'ready', listener: () => void): this;
  on(event: 'query', listener: (query: MdnsQuery) => void): this;
  on(event: 'error' | 'warning', listener: (error: Error) => void): this;
  respond(packet: { answers: MdnsRecord[] }, callback?: (error?: Error | null) => void): void;
  destroy(callback?: () => void): void;
}

interface MdnsOptions {
  interface: string;
  ip: string;
  port: number;
  ttl: number;
  reuseAddr: boolean;
  loopback: boolean;
}

export interface LocalHostnamePublisherOptions {
  getPrimaryLanIp: () => string | null;
  port: number;
  logger: {
    info: (message: string, metadata?: unknown) => void;
    warn: (message: string, metadata?: unknown) => void;
  };
  createClient?: (options: MdnsOptions) => MdnsClient;
  refreshIntervalMs?: number;
}

function isLocalHostnameQuestion(question: MdnsQuestion): boolean {
  const questionName = String(question.name || '').replace(/\.$/, '').toLowerCase();
  const questionType = String(question.type).toUpperCase();
  return questionName === LOCAL_HUB_HOSTNAME && (questionType === 'A' || questionType === 'ANY');
}

export class LocalHostnamePublisher {
  private readonly getPrimaryLanIp: () => string | null;
  private readonly port: number;
  private readonly logger: LocalHostnamePublisherOptions['logger'];
  private readonly createClient: (options: MdnsOptions) => MdnsClient;
  private readonly refreshIntervalMs: number;
  private client: MdnsClient | null = null;
  private advertisedIp: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;
  private stopped = false;
  private state: LocalHostnameStatus['state'] = 'stopped';
  private lastError: string | null = null;
  private lastLoggedError: string | null = null;
  private announcementTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(options: LocalHostnamePublisherOptions) {
    this.getPrimaryLanIp = options.getPrimaryLanIp;
    this.port = options.port;
    this.logger = options.logger;
    this.createClient = options.createClient || ((clientOptions) => multicastDns(clientOptions) as unknown as MdnsClient);
    this.refreshIntervalMs = options.refreshIntervalMs || 5000;
  }

  get status(): LocalHostnameStatus {
    return {
      state: this.state,
      hostname: LOCAL_HUB_HOSTNAME,
      address: this.advertisedIp,
      lastError: this.lastError,
    };
  }

  get isPublished(): boolean {
    return this.state === 'published' && this.client !== null && this.advertisedIp !== null;
  }

  get url(): string | null {
    return this.isPublished ? `http://${LOCAL_HUB_HOSTNAME}:${this.port}` : null;
  }

  start(): void {
    if (this.refreshTimer) return;
    this.stopped = false;
    this.state = 'waiting-for-network';
    void this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, this.refreshIntervalMs);
    this.refreshTimer.unref?.();
  }

  async refresh(): Promise<void> {
    if (this.stopped || this.refreshing) return;
    this.refreshing = true;

    try {
      let nextIp: string | null = null;
      try {
        nextIp = this.getPrimaryLanIp();
      } catch (error: any) {
        await this.closeCurrentClient(true);
        this.failWithoutClient(error);
        return;
      }

      if (nextIp && this.client && nextIp === this.advertisedIp) return;
      if (!nextIp && !this.client) {
        this.state = 'waiting-for-network';
        return;
      }

      await this.closeCurrentClient(true);
      if (this.stopped) return;

      if (!nextIp) {
        this.state = 'waiting-for-network';
        this.lastError = null;
        return;
      }

      this.openForAddress(nextIp);
    } finally {
      this.refreshing = false;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    await this.closeCurrentClient(true);
    this.state = 'stopped';
  }

  private createRecord(address: string, ttl = RECORD_TTL_SECONDS): MdnsRecord {
    return {
      name: LOCAL_HUB_HOSTNAME,
      type: 'A',
      class: 'IN',
      ttl,
      flush: true,
      data: address,
    };
  }

  private openForAddress(address: string): void {
    let client: MdnsClient;
    try {
      client = this.createClient({
        interface: address,
        ip: MDNS_MULTICAST_ADDRESS,
        port: MDNS_PORT,
        ttl: 255,
        reuseAddr: true,
        loopback: false,
      });
    } catch (error: any) {
      this.failWithoutClient(error);
      return;
    }

    this.client = client;
    this.advertisedIp = address;
    this.state = 'starting';
    this.lastError = null;

    client.on('error', (error) => {
      this.failClient(client, error);
    });

    client.on('warning', (error) => {
      if (this.client === client) {
        this.logger.warn('RestaurantOS mDNS warning.', { error: error?.message || String(error) });
      }
    });

    client.on('query', (query) => {
      if (this.client !== client || !query.questions?.some(isLocalHostnameQuestion)) return;
      this.respond(client, address, RECORD_TTL_SECONDS);
    });

    client.on('ready', () => {
      if (this.client !== client) return;
      this.publishAddress(client, address, 0);
    });
  }

  private publishAddress(client: MdnsClient, address: string, announcementNumber: number): void {
    this.respond(client, address, RECORD_TTL_SECONDS, (error) => {
      if (this.client !== client) return;
      if (error) {
        this.failClient(client, error);
        return;
      }

      if (announcementNumber === 0) {
        this.state = 'published';
        this.lastError = null;
        this.lastLoggedError = null;
        this.logger.info('RestaurantOS local hostname published.', {
          hostname: LOCAL_HUB_HOSTNAME,
          address,
          port: this.port,
        });
      }

      // Repeat the unsolicited announcement to reduce the chance that a
      // single lost multicast packet leaves clients with a stale address.
      if (announcementNumber < 2) {
        const delayMs = announcementNumber === 0 ? 1000 : 2000;
        const timer = setTimeout(() => {
          this.announcementTimers.delete(timer);
          if (this.client === client) this.publishAddress(client, address, announcementNumber + 1);
        }, delayMs);
        timer.unref?.();
        this.announcementTimers.add(timer);
      }
    });
  }

  private respond(
    client: MdnsClient,
    address: string,
    ttl: number,
    callback?: (error?: Error | null) => void,
  ): void {
    try {
      client.respond({ answers: [this.createRecord(address, ttl)] }, (error) => {
        if (error && this.client === client && !callback) {
          this.logger.warn('Could not answer RestaurantOS mDNS request.', { error: error.message });
        }
        callback?.(error);
      });
    } catch (error: any) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      callback?.(normalized);
      if (!callback) {
        this.logger.warn('Could not answer RestaurantOS mDNS request.', { error: normalized.message });
      }
    }
  }

  private failWithoutClient(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.state = 'error';
    this.lastError = normalized.message;
    if (this.lastLoggedError !== normalized.message) {
      this.logger.warn('RestaurantOS mDNS discovery is unavailable; LAN IP access remains available.', {
        error: normalized.message,
      });
      this.lastLoggedError = normalized.message;
    }
  }

  private failClient(client: MdnsClient, error: unknown): void {
    if (this.client !== client) return;
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.client = null;
    this.advertisedIp = null;
    this.state = 'error';
    this.lastError = normalized.message;
    if (this.lastLoggedError !== normalized.message) {
      this.logger.warn('RestaurantOS mDNS discovery is unavailable; LAN IP access remains available.', {
        error: normalized.message,
      });
      this.lastLoggedError = normalized.message;
    }
    try {
      client.destroy();
    } catch {}
  }

  private async closeCurrentClient(sendGoodbye: boolean): Promise<void> {
    const client = this.client;
    const address = this.advertisedIp;
    for (const timer of this.announcementTimers) clearTimeout(timer);
    this.announcementTimers.clear();
    this.client = null;
    this.advertisedIp = null;

    if (!client) return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        try {
          client.destroy(resolve);
        } catch {
          resolve();
        }
      };
      const timeout = setTimeout(finish, 1000);
      timeout.unref?.();

      if (sendGoodbye && address) {
        try {
          client.respond({ answers: [this.createRecord(address, 0)] }, finish);
        } catch {
          finish();
        }
      } else {
        finish();
      }
    });
  }
}
