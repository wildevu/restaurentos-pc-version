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

  readonly destinations: Array<{ address?: string; port?: number } | null> = [];

  respond(packet: any, remoteInfoOrCallback?: any, callback?: (error?: Error | null) => void): void {
    const remoteInfo = typeof remoteInfoOrCallback === 'function' ? null : remoteInfoOrCallback || null;
    const onSent = typeof remoteInfoOrCallback === 'function' ? remoteInfoOrCallback : callback;
    this.responses.push(packet);
    this.destinations.push(remoteInfo);
    onSent?.();
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

  clients[0].emit('query', { id: 0, questions: [{ name: 'RESTOS.LOCAL.', type: 'A', class: 1 }] }, { address: '192.168.1.99', port: 5353 });
  assert.equal(clients[0].responses.length, 2);
  assert.equal(clients[0].destinations[1], null, 'standard mDNS query receives multicast response');
  assert.equal(publisher.status.queryCount, 1, 'matching hostname queries are counted');
  assert.ok(publisher.status.lastQueryAt, 'last matching query time is available');
  assert.equal(publisher.status.lastQuerySourceAddress, '192.168.1.99', 'query source address is exposed for client diagnostics');
  assert.equal(publisher.status.lastQuerySourcePort, 5353, 'query source port is exposed for client diagnostics');
  assert.deepEqual(publisher.status.lastQueryTypes, ['A'], 'queried DNS record types are exposed for diagnostics');
  assert.equal(publisher.status.responseCount, 1, 'successful mDNS response sends are counted');
  assert.equal(publisher.status.lastResponseMode, 'multicast', 'standard mDNS query uses multicast');
  assert.ok(publisher.status.lastResponseAt, 'last successful response time is available');
  assert.equal(publisher.status.lastResponseError, null, 'successful response clears prior response errors');

  // Android's AOSP resolver sends one-shot mDNS queries from a random source port.
  const androidQuery = { id: 0x4a21, flags: 0x0100, questions: [{ name: 'restos.local.', type: 'A', class: 1 }] };
  clients[0].emit('query', androidQuery, { address: '192.168.1.77', port: 49152 });
  const androidResponse = clients[0].responses[2];
  assert.deepEqual(clients[0].destinations[2], { address: '192.168.1.77', port: 49152 }, 'legacy response is unicast to Android query source');
  assert.equal(androidResponse.id, 0x4a21, 'legacy response repeats the query ID');
  assert.equal(androidResponse.flags, 0x0100, 'legacy response preserves only the DNS Recursion Desired flag');
  assert.deepEqual(androidResponse.questions, androidQuery.questions, 'legacy response repeats the query question');
  assert.equal(androidResponse.answers[0].ttl, 10, 'legacy unicast TTL is capped at ten seconds');
  assert.equal(androidResponse.answers[0].flush, false, 'legacy response omits cache-flush bit');
  assert.equal(publisher.status.lastResponseMode, 'legacy-unicast', 'Android one-shot query is reported as legacy unicast');
  assert.equal(publisher.status.legacyUnicastResponseCount, 1, 'legacy unicast response count is tracked');

  // A compliant mDNS client can request a unicast reply with the QU class bit.
  clients[0].emit('query', { id: 0, questions: [{ name: 'restos.local.', type: 'A', class: 0x8001 }] }, { address: '192.168.1.88', port: 5353 });
  const quResponse = clients[0].responses[3];
  assert.deepEqual(clients[0].destinations[3], { address: '192.168.1.88', port: 5353 }, 'QU query receives a unicast response');
  assert.equal(quResponse.id, 0, 'QU mDNS response uses query ID zero');
  assert.equal(quResponse.questions, undefined, 'QU response omits repeated question section');
  assert.equal(quResponse.answers[0].flush, true, 'QU response retains cache-flush semantics');
  assert.equal(publisher.status.unicastResponseCount, 1, 'QU unicast response count is tracked');

  clients[0].emit('query', { questions: [{ name: 'restos.local.', type: 1, class: 1 }] }, { address: '192.168.1.100', port: 5353 });
  assert.equal(clients[0].responses.length, 5, 'numeric A record questions are answered');
  assert.equal(publisher.status.queryCount, 4);

  clients[0].emit('query', { questions: [{ name: 'printer.local', type: 'A' }] });
  assert.equal(clients[0].responses.length, 5, 'unrelated .local questions are ignored');

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
