const cryptoProxy = new Proxy({}, {
  get(target, prop) {
    if (prop !== '__esModule' && prop !== 'then' && prop !== 'constructor' && prop !== 'splice') {
      throw new Error(`Module "crypto" has been externalized...`);
    }
  }
});
try {
  console.log(typeof cryptoProxy.randomUUID === 'function');
} catch (e) {
  console.error("IT THREW:", e.message);
}
