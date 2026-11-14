import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  LOCAL_HUB_HOSTNAME,
  LocalHostnamePublisher,
  type LocalHostnamePublisherOptions,
} from '../src/network/local-hostname';

class FakeMdnsClient extends EventEmitter {
  readonly options: any;
  readonly responses: any[] = [];
  destroyed = false;

  constructor(options: any) {
    super();
    this.options = options;
  }

  respond(packet: any, callback?: (error?: Error | null) => void): void {
    this.responses.push(packet);
    callback?.();
  }

  destroy(callback?: () => void): void {
    this.destroyed = true;
    callback?.();
  }
}

async function run(): Promise<void> {
  let currentIp: string | null = null;
  const clients: FakeMdnsClient[] = [];
  const logger = {
    info: (_message: string, _metadata?: unknown) => {},
    warn: (_message: string, _metadata?: unknown) => {},
  };

  const options: LocalHostnamePublisherOptions = {
    getPrimaryLanIp: () => currentIp,
    port: 8989,
    logger,
    refreshIntervalMs: 60000,
    createClient: (clientOptions) => {
      const client = new FakeMdnsClient(clientOptions);
      clients.push(client);
      return client as any;
    },
  };

  const publisher = new LocalHostnamePublisher(options);

  await publisher.refresh();
  assert.equal(publisher.status.state, 'waiting-for-network');
  assert.equal(clients.length, 0);

  currentIp = '192.168.1.50';
  await publisher.refresh();
  assert.equal(clients.length, 1);
  assert.equal(clients[0].options.interface, currentIp);
  assert.equal(clients[0].options.port, 5353);
  assert.equal(clients[0].options.ip, '224.0.0.251');

  clients[0].emit('ready');
  assert.equal(publisher.isPublished, true);
  assert.equal(publisher.url, 'http://restos.local:8989');
  assert.equal(clients[0].responses[0].answers[0].name, LOCAL_HUB_HOSTNAME);
  assert.equal(clients[0].responses[0].answers[0].data, '192.168.1.50');
  assert.equal(clients[0].responses[0].answers[0].ttl, 30);
  assert.equal(clients[0].responses[0].answers[0].flush, true);

  clients[0].emit('query', { questions: [{ name: 'RESTOS.LOCAL.', type: 'A' }] });
  assert.equal(clients[0].responses.length, 2);
  assert.equal(publisher.status.queryCount, 1, 'matching hostname queries are counted');
  assert.ok(publisher.status.lastQueryAt, 'last matching query time is available');
  assert.deepEqual(publisher.status.lastQueryTypes, ['A'], 'queried DNS record types are exposed for diagnostics');
  assert.equal(publisher.status.responseCount, 1, 'successful mDNS response sends are counted');
  assert.ok(publisher.status.lastResponseAt, 'last successful response time is available');
  assert.equal(publisher.status.lastResponseError, null, 'successful response clears prior response errors');

  clients[0].emit('query', { questions: [{ name: 'restos.local.', type: 1 }] });
  assert.equal(clients[0].responses.length, 3, 'numeric A record questions are answered');
  assert.equal(publisher.status.queryCount, 2);

  clients[0].emit('query', { questions: [{ name: 'printer.local', type: 'A' }] });
  assert.equal(clients[0].responses.length, 3, 'unrelated .local questions are ignored');

  currentIp = '192.168.1.73';
  await publisher.refresh();
  const oldIpGoodbye = clients[0].responses.at(-1);
  assert.equal(oldIpGoodbye?.answers?.[0]?.data, '192.168.1.50', 'goodbye record should withdraw the previously advertised IP');
  assert.equal(oldIpGoodbye?.answers?.[0]?.ttl, 0, 'old IP should be withdrawn with a goodbye record');
  assert.equal(clients[0].destroyed, true);
  assert.equal(clients.length, 2);
  assert.equal(clients[1].options.interface, '192.168.1.73');

  clients[1].emit('ready');
  assert.equal(publisher.isPublished, true);
  assert.equal(publisher.url, 'http://restos.local:8989', 'hostname URL must not change when the IP changes');
  assert.equal(clients[1].responses[0].answers[0].data, '192.168.1.73');

  currentIp = null;
  await publisher.refresh();
  assert.equal(clients[1].responses[1].answers[0].ttl, 0);
  assert.equal(clients[1].destroyed, true);
  assert.equal(publisher.status.state, 'waiting-for-network');
  assert.equal(publisher.url, null);

  await publisher.stop();
  assert.equal(publisher.status.state, 'stopped');
  console.log('Local hostname discovery regression checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
