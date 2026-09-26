
import asyncio
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Set

from aiohttp import web, ClientSession

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", os.getenv("SKYBREAK_PORT", "8000")))
SERVER_NAME = os.getenv("SKYBREAK_SERVER_NAME", "CHERNOBYL // ZONE NODE")[:40]
PUBLIC_ADDRESS = os.getenv("SKYBREAK_PUBLIC_ADDRESS", "")
MASTER_URL = os.getenv("SKYBREAK_MASTER_URL", "").rstrip("/")
MASTER_TOKEN = os.getenv("SKYBREAK_MASTER_TOKEN", "")

# A node can also act as a lightweight master directory. Other public nodes
# can point SKYBREAK_MASTER_URL at it to aggregate their live player lists.
master_nodes: Dict[str, dict] = {}

@dataclass
class Player:
    pid: str
    name: str
    ws: object
    room: str = ""
    x: float = 0.0
    y: float = 18.0
    z: float = 0.0
    yaw: float = 0.0
    pitch: float = 0.0
    hp: int = 100
    ready: bool = False
    role: str = "pilot"

@dataclass
class Room:
    rid: str
    mode: str = "pvp"
    players: Dict[str, Player] = field(default_factory=dict)
    started: bool = False
    created: float = field(default_factory=time.time)

rooms: Dict[str, Room] = {}
players: Dict[str, Player] = {}

INDEX = os.path.join(os.path.dirname(__file__), "..", "client")


@web.middleware
async def cors_middleware(request, handler):
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

async def http_index(request):
    return web.FileResponse(os.path.join(INDEX, "index.html"))

async def http_file(request):
    rel = request.match_info["path"]
    path = os.path.abspath(os.path.join(INDEX, rel))
    if not path.startswith(os.path.abspath(INDEX)):
        raise web.HTTPForbidden()
    if not os.path.isfile(path):
        raise web.HTTPNotFound()
    return web.FileResponse(path)

async def http_health(request):
    return web.json_response({
        "ok": True,
        "server": SERVER_NAME,
        "rooms": len(rooms),
        "players": len(players),
        "master": bool(MASTER_URL),
        "public_address": PUBLIC_ADDRESS
    })

def local_global_players():
    result = []
    for p in players.values():
        if not p.room:
            continue
        result.append({
            "name": p.name,
            "room": p.room,
            "server": SERVER_NAME,
            "region": "ZONE",
            "role": p.role
        })
    return result

async def http_global(request):
    # If this node is configured as a client of a central master, use its
    # aggregated live directory. Otherwise expose all players on this node.
    if MASTER_URL:
        try:
            async with ClientSession() as session:
                headers = {"Authorization": f"Bearer {MASTER_TOKEN}"} if MASTER_TOKEN else {}
                async with session.get(f"{MASTER_URL}/master/players", headers=headers, timeout=2) as resp:
                    if resp.ok:
                        data = await resp.json()
                        return web.json_response(data)
        except Exception:
            pass
    local = local_global_players()
    return web.json_response({
        "total_players": len(local),
        "servers": 1 if local else 0,
        "players": local
    })

async def master_register(request):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if MASTER_TOKEN and token != MASTER_TOKEN:
        raise web.HTTPUnauthorized()
    data = await request.json()
    node_id = str(data.get("node_id", "")).strip()[:64]
    if not node_id:
        raise web.HTTPBadRequest(text="node_id required")
    master_nodes[node_id] = {
        "name": str(data.get("server", "ZONE NODE"))[:40],
        "address": str(data.get("address", ""))[:120],
        "players": data.get("players", [])[:64],
        "last_seen": time.time()
    }
    return web.json_response({"ok": True})

async def master_players(request):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if MASTER_TOKEN and token != MASTER_TOKEN:
        raise web.HTTPUnauthorized()
    now = time.time()
    for node_id, node in list(master_nodes.items()):
        if now - node["last_seen"] > 30:
            master_nodes.pop(node_id, None)
    all_players = []
    for node in master_nodes.values():
        for p in node.get("players", []):
            item = dict(p)
            item["server"] = node["name"]
            item["region"] = node.get("address") or "WORLD"
            all_players.append(item)
    return web.json_response({
        "total_players": len(all_players),
        "servers": len(master_nodes),
        "players": all_players[:256]
    })

async def register_master_forever():
    if not MASTER_URL:
        return
    node_id = uuid.uuid5(uuid.NAMESPACE_URL, PUBLIC_ADDRESS or f"{SERVER_NAME}:{WS_PORT}").hex
    while True:
        try:
            payload = {
                "node_id": node_id,
                "server": SERVER_NAME,
                "address": PUBLIC_ADDRESS,
                "players": local_global_players()
            }
            headers = {"Authorization": f"Bearer {MASTER_TOKEN}"} if MASTER_TOKEN else {}
            async with ClientSession() as session:
                await session.post(f"{MASTER_URL}/master/register", json=payload, headers=headers, timeout=3)
        except Exception:
            pass
        await asyncio.sleep(10)

async def send(ws, data):
    try:
        await ws.send(json.dumps(data, separators=(",", ":")))
    except Exception:
        pass

async def broadcast(room, data, exclude=None):
    dead = []
    payload = json.dumps(data, separators=(",", ":"))
    for p in list(room.players.values()):
        if p.pid == exclude:
            continue
        try:
            await p.ws.send(payload)
        except Exception:
            dead.append(p.pid)
    for pid in dead:
        room.players.pop(pid, None)
        players.pop(pid, None)

def room_state(room):
    return {
        "type": "room_state",
        "room": room.rid,
        "mode": room.mode,
        "started": room.started,
        "players": [
            {
                "id": p.pid, "name": p.name, "ready": p.ready,
                "role": p.role, "hp": p.hp,
                "pos": [p.x, p.y, p.z],
                "yaw": p.yaw, "pitch": p.pitch
            } for p in room.players.values()
        ]
    }

async def handle_message(p, msg):
    t = msg.get("type")

    if t == "create":
        rid = str(msg.get("room", "")).strip()[:24] or uuid.uuid4().hex[:6].upper()
        mode = "coop" if msg.get("mode") == "coop" else "pvp"
        if rid in rooms:
            await send(p.ws, {"type": "error", "message": "Комната уже существует"})
            return
        room = Room(rid=rid, mode=mode)
        rooms[rid] = room
        p.room = rid
        p.role = "host"
        room.players[p.pid] = p
        await send(p.ws, room_state(room))
        return

    if t == "join":
        rid = str(msg.get("room", "")).strip()[:24]
        room = rooms.get(rid)
        if not room:
            await send(p.ws, {"type": "error", "message": "Комната не найдена"})
            return
        if len(room.players) >= 8:
            await send(p.ws, {"type": "error", "message": "Комната заполнена (максимум 8 пилотов)"})
            return
        p.room = rid
        p.role = "pilot"
        room.players[p.pid] = p
        await broadcast(room, room_state(room))
        return

    if t == "ready":
        room = rooms.get(p.room)
        if not room:
            return
        p.ready = bool(msg.get("ready", True))
        await broadcast(room, room_state(room))
        return

    if t == "start":
        room = rooms.get(p.room)
        if not room or len(room.players) < 1:
            return
        room.started = True
        for i, pl in enumerate(room.players.values()):
            pl.x = -24.0 if i == 0 else 24.0
            pl.z = 0.0
            pl.y = 18.0
            pl.hp = 100
        await broadcast(room, {"type": "start", "mode": room.mode})
        await broadcast(room, room_state(room))
        return

    if t == "state":
        room = rooms.get(p.room)
        if not room:
            return
        pos = msg.get("pos", [p.x, p.y, p.z])
        p.x, p.y, p.z = [float(v) for v in pos[:3]]
        p.yaw = float(msg.get("yaw", p.yaw))
        p.pitch = float(msg.get("pitch", p.pitch))
        p.hp = max(0, min(100, int(msg.get("hp", p.hp))))
        await broadcast(room, {
            "type": "player_state", "id": p.pid,
            "pos": [p.x, p.y, p.z],
            "yaw": p.yaw, "pitch": p.pitch, "hp": p.hp
        }, exclude=p.pid)
        return

    if t == "impact":
        room = rooms.get(p.room)
        if not room:
            return
        await broadcast(room, {
            "type": "impact",
            "id": p.pid,
            "pos": msg.get("pos", [0,0,0]),
            "power": float(msg.get("power", 1.0))
        })
        return

    if t == "ping":
        await send(p.ws, {"type": "pong", "t": msg.get("t", time.time())})

async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=25, max_msg_size=2**20)
    await ws.prepare(request)
    p = Player(pid=uuid.uuid4().hex[:10], name="Pilot", ws=ws)
    players[p.pid] = p
    await send(ws, {"type": "hello", "id": p.pid})
    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    if isinstance(data, dict):
                        if "name" in data:
                            p.name = str(data["name"])[:20] or "Pilot"
                        await handle_message(p, data)
                except Exception as exc:
                    await send(ws, {"type": "error", "message": f"bad message: {exc}"})
            elif msg.type in (web.WSMsgType.CLOSE, web.WSMsgType.ERROR):
                break
    finally:
        room = rooms.get(p.room)
        if room:
            room.players.pop(p.pid, None)
            await broadcast(room, room_state(room))
            if not room.players:
                rooms.pop(room.rid, None)
        players.pop(p.pid, None)
    return ws

def make_app():
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get("/", http_index)
    app.router.add_get("/health", http_health)
    app.router.add_get("/api/global", http_global)
    app.router.add_get("/ws", ws_handler)
    app.router.add_post("/master/register", master_register)
    app.router.add_get("/master/players", master_players)
    app.router.add_get("/{path:.*}", http_file)
    return app

async def main():
    runner = web.AppRunner(make_app())
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()
    print(f"SKYBREAK ZONE NETWORK — public port {PORT}")
    print(f"HTTP: http://127.0.0.1:{PORT}")
    print(f"WS:   ws://127.0.0.1:{PORT}/ws")
    print(f"SERVER: {SERVER_NAME}")
    if MASTER_URL:
        print(f"MASTER: {MASTER_URL}")
    asyncio.create_task(register_master_forever())
    await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
