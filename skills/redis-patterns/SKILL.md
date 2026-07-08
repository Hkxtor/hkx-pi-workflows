---
name: hkx-redis-patterns
description: Redis data structure patterns, caching strategies, distributed locks, rate limiting, and connection management for production applications (compact OMP version).
origin: ECC-converted-for-OMP
---

# Redis Patterns

Quick reference for Redis best practices across common backend use cases.

## When to Activate

- Adding caching to an application
- Implementing rate limiting or throttling
- Building distributed locks or coordination
- Setting up session or token storage
- Configuring Redis in production (pooling, eviction)

## Data Structure Cheat Sheet

| Use Case | Structure | Example Key |
|----------|-----------|-------------|
| Simple cache | String | `product:123` |
| User session | Hash | `session:abc` |
| Leaderboard | Sorted Set | `scores:weekly` |
| Unique visitors | Set | `visitors:2024-01-01` |
| Activity feed | List | `feed:user:456` |
| Event stream | Stream | `events:orders` |
| Counters / rate limits | String (INCR) | `ratelimit:user:123` |
| Bloom filter / HLL | HyperLogLog | `hll:pageviews` |

## Core Patterns

### Cache-Aside (Lazy Loading)

```python
import redis, json
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

def get_product(product_id: int):
    cache_key = f"product:{product_id}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)
    product = db.query("SELECT * FROM products WHERE id = %s", product_id)
    r.setex(cache_key, 3600, json.dumps(product))
    return product
```

### Write-Through Cache

```python
def update_product(product_id: int, data: dict):
    db.execute("UPDATE products SET ... WHERE id = %s", product_id)
    cache_key = f"product:{product_id}"
    r.setex(cache_key, 3600, json.dumps(data))
```

### Cache Invalidation (Tag-Based)

```python
def cache_product(product_id: int, category_id: int, data: dict):
    key = f"product:{product_id}"
    tag = f"tag:category:{category_id}"
    pipe = r.pipeline(transaction=True)
    pipe.setex(key, 3600, json.dumps(data))
    pipe.sadd(tag, key)
    pipe.expire(tag, 3600)
    pipe.execute()

def invalidate_category(category_id: int):
    tag = f"tag:category:{category_id}"
    keys = r.smembers(tag)
    if keys:
        r.delete(*keys)
    r.delete(tag)
```

### Session Storage

```python
import time, uuid

def create_session(user_id: int, ttl: int = 86400) -> str:
    session_id = str(uuid.uuid4())
    key = f"session:{session_id}"
    pipe = r.pipeline(transaction=True)
    pipe.hset(key, mapping={"user_id": user_id, "created_at": int(time.time())})
    pipe.expire(key, ttl)
    pipe.execute()
    return session_id

def get_session(session_id: str) -> dict | None:
    return r.hgetall(f"session:{session_id}") or None

def delete_session(session_id: str):
    r.delete(f"session:{session_id}")
```

## Rate Limiting

### Fixed Window

```python
def is_rate_limited(user_id: int, limit: int = 100, window: int = 60) -> bool:
    key = f"ratelimit:{user_id}:{int(time.time()) // window}"
    pipe = r.pipeline(transaction=True)
    pipe.incr(key)
    pipe.expire(key, window)
    count, _ = pipe.execute()
    return count > limit
```

> **Note:** For sliding window (Lua-based atomic), see the full ECC `redis-patterns` skill — it provides an accurate per-user throttling alternative.

## Distributed Locks

### Single Node — SET NX PX

```python
import uuid

def acquire_lock(resource: str, ttl_ms: int = 5000) -> str | None:
    lock_key = f"lock:{resource}"
    token = str(uuid.uuid4())
    acquired = r.set(lock_key, token, px=ttl_ms, nx=True)
    return token if acquired else None

def release_lock(resource: str, token: str) -> bool:
    release_script = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    else
        return 0
    end
    """
    return bool(r.eval(release_script, 1, f"lock:{resource}", token))

# Usage
token = acquire_lock("order:payment:123")
if token:
    try:
        process_payment()
    finally:
        release_lock("order:payment:123", token)
```

> For multi-node setups use `redlock-py` (full Redlock algorithm).

## Key Design

### Naming Conventions

```
# Pattern: resource:id:field
user:123:profile
order:456:status
namespace:resource:id
myapp:session:abc123
```

### TTL Strategy

| Data Type | Suggested TTL |
|-----------|--------------|
| User session | 24h (`86400`) |
| API response cache | 5–15 min |
| Rate limit window | Match window size |
| Short-lived tokens | 5–10 min |
| Leaderboard | 1h–24h |

Always set a TTL. Keys without TTL accumulate indefinitely.

## Connection Management

### Connection Pooling

```python
from redis import ConnectionPool, Redis

pool = ConnectionPool(
    host='localhost', port=6379, db=0,
    max_connections=20, decode_responses=True,
    socket_connect_timeout=2, socket_timeout=2,
)
r = Redis(connection_pool=pool)
```

## Related

- Skill: `postgres-patterns` — relational data patterns
- Skill: `database-migrations` — schema versioning
- Agent: `database-reviewer` — full database review workflow (OMP agent, if available)
