/**
 * Test Redis Connection
 * Verifies Redis is properly configured and accessible
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL!;

async function testRedis() {
  console.log('\n🔴 REDIS CONNECTION TEST\n');
  console.log('='.repeat(50));

  if (!REDIS_URL) {
    console.log('❌ REDIS_URL not set');
    process.exit(1);
  }

  console.log(`📡 Connecting to: ${REDIS_URL.replace(/:[^:@]+@/, ':****@')}`);

  const redis = new Redis(REDIS_URL);

  try {
    // Test 1: PING
    const pong = await redis.ping();
    console.log(`✅ PING: ${pong}`);

    // Test 2: SET
    await redis.set('test:key', 'hello-molt-company');
    console.log('✅ SET: test:key = hello-molt-company');

    // Test 3: GET
    const value = await redis.get('test:key');
    if (value === 'hello-molt-company') {
      console.log(`✅ GET: test:key = ${value}`);
    } else {
      throw new Error(`Expected 'hello-molt-company', got '${value}'`);
    }

    // Test 4: INCR (for rate limiting)
    await redis.set('test:counter', '0');
    const count = await redis.incr('test:counter');
    console.log(`✅ INCR: test:counter = ${count}`);

    // Test 5: EXPIRE (TTL)
    await redis.expire('test:key', 60);
    const ttl = await redis.ttl('test:key');
    console.log(`✅ EXPIRE: test:key TTL = ${ttl}s`);

    // Test 6: DEL (cleanup)
    await redis.del('test:key', 'test:counter');
    console.log('✅ DEL: cleaned up test keys');

    // Test 7: Server Info
    const info = await redis.info('server');
    const version = info.match(/redis_version:(\S+)/)?.[1] || 'unknown';
    console.log(`✅ INFO: Redis version ${version}`);

    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Results: All Redis tests passed!\n');

  } catch (error: any) {
    console.log(`\n❌ Redis test failed: ${error.message}`);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

testRedis().catch(console.error);
