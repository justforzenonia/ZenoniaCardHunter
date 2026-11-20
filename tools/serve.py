"""Local dev server for the game: like `python -m http.server`, but tells the browser never to cache, so a fresh
reload always runs the newest code. Usage: python tools/serve.py [port]   (serves the zenonia_rpg folder on 127.0.0.1)

THE PUBLIC GAME SERVER (2026-11-19, the user's website): python tools/serve.py 8766 --public
  serves ROOT/www (the website: www/index.html, the game in www/play/, see tools/build_site.py) to Caddy on this machine, which
  adds https. Co-op rooms, the market board and hero codes answer any site and the phone app. Anything that belongs to one PC
  only is switched off: the disk copy of saves (/save, /save/list, /save/archive), photos and folder listings. Requests are
  size-capped, and rooms and hero codes are limited in number, so strangers can't fill the server's memory."""
import functools, http.server, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = '--public' in sys.argv
BODY_MAX = 512 << 10   # (public: the largest co-op message or hero a request may carry)


class NoCache(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'   # keep-alive: online co-op's many small messages reuse one connection instead of opening a new one each time

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')   # the browser keeps files but asks every time; unchanged ones come back as a tiny 304 (the 9.5 MB pack isn't sent again on each reload or co-op join)
        if self._shared(): self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    # THE PHONE APP AND FRIENDS (2026-11-19, the user chose "Phone app + friends"): the app's pages come from inside the app, so its
    # calls to this server are from another origin. Only the MARKET board and the hero codes (save/share) answer such calls; the
    # game's files, the save slots and the photos stay for pages served from here.
    def _shared(self):
        p = (getattr(self, 'path', '') or '').split('?')[0]
        # (/health too, 2026-11-20: the website's "Server online" light on GitHub Pages asks it from another site, and without this
        # header the browser hid the answer, so the light said "Server down" while the server was up)
        return p.startswith('/market/') or p.startswith('/net/') or p in ('/save/share', '/health', '/cloud/save', '/stats/hello')   # (co-op too: the app and the website's game meet in the same rooms)

    def _private(self):   # (public server: what belongs to one PC only)
        p = (getattr(self, 'path', '') or '').split('?')[0]
        return PUBLIC and (p in ('/save', '/save/list', '/save/archive', '/photo', '/photo/list') or p.startswith('/photos/') or p.startswith('/saves/'))

    def _too_big(self):
        if PUBLIC and int(self.headers.get('Content-Length') or 0) > BODY_MAX:
            self.close_connection = True; self.send_error(413); return True
        return False

    def list_directory(self, path):   # (public: no folder listings)
        if PUBLIC: self.send_error(404); return None
        return super().list_directory(path)

    def do_OPTIONS(self):   # the browser's question before a POST from another origin
        if not self._shared(): return self.send_error(405)
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true'); self.send_header('Access-Control-Max-Age', '600'); self.send_header('Content-Length', '0')
        self.end_headers()

    def log_message(self, *a):
        pass

    def copyfile(self, src, dst):   # Python 3.15's own copy cut the last 2 KB off the 9.5 MB pack.bin, so the game never finished loading
        while True:
            b = src.read(1 << 16)
            if not b: break
            dst.write(b)
        dst.flush()


    # ---- ONLINE CO-OP RELAY (js/net.js): rooms held in memory, a few small JSON messages, nothing written to disk. A room has one
    # host and up to NET_GUESTS guests, each with an id (gid) the relay gives them when they join.
    #   POST /net/host  {seed, profile}          -> {room}           the host opens a room
    #   GET  /net/info?room=R                    -> host info        a guest checks the room and gets the world seed ("full" when it is)
    #   POST /net/join?room=R  {profile}         -> {ok, gid}        a guest joins (409 when the room is full)
    #   POST /net/leave?room=R[&who=guest&gid=G] -> {ok}             the host closes the room, or a guest steps out of it
    #   GET  /net/hello?room=R                   -> [{gid, hello}]   the host learns who is in (guests heard from in the last 5 s)
    #   POST /net/in?room=R&gid=G {input} · GET /net/in?room=R -> {gid: [inputs]}   guests' keys to the host (queued, read once;
    #                                                               a guest missing from the answer has left)
    #   POST /net/snap?room=R  {snapshot} · GET /net/snap?room=R -> latest   the host's world to the guests
    def _net(self, method):
        import json, random, string, threading, time, urllib.parse
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query); room = (q.get('room') or [''])[0].upper(); gid = (q.get('gid') or [''])[0]
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n) if n else b''
        R = ROOMS.get(room)
        def out(obj, raw=None, code=200):
            b = raw if raw is not None else json.dumps(obj).encode()
            self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
        if u.path == '/net/ping': return out({ 'ok': True })   # a no-op the test harness (tools/test/coop_harness.js __wait) polls to pass time
        if u.path == '/net/addr':   # this computer's addresses on the home network, for the Log's HOST CODE tab
            global NET_IPS
            if NET_IPS is None:   # (looked up once: the lookup is slow on Windows)
                import socket
                try: NET_IPS = [ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith('127.')]
                except OSError: NET_IPS = []
            ips = NET_IPS
            return out({ 'ips': ips if self.server.server_address[0] == '0.0.0.0' and not PUBLIC else [], 'port': self.server.server_address[1] })
        with NET_LOCK:
            for k in [k for k, v in ROOMS.items() if time.time() - v['seen'] > 600]: del ROOMS[k]   # (rooms nobody has touched for 10 minutes close)
            if u.path == '/net/host' and method == 'POST':
                if len(ROOMS) >= ROOMS_MAX: return out({ 'error': 'the server is full, try again soon' }, code=503)
                code = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ') for _ in range(4))
                while code in ROOMS: code = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ') for _ in range(4))
                ROOMS[code] = { 'info': body, 'guests': {}, 'next': 0, 'snap': b'null', 'seen': time.time() }
                return out({ 'room': code })
            if not R: return out({ 'error': 'no such room' }, code=404)
            R['seen'] = time.time(); G = R['guests']
            live = { k: g for k, g in G.items() if time.time() - g['seen'] < 5 }   # (a guest counts as there while their keys keep coming)
            full = len(live) >= NET_GUESTS
            if u.path == '/net/info': return out(None, R['info'][:-1] + b', "full": true}' if full and R['info'].endswith(b'}') else R['info'])
            if u.path == '/net/join' and method == 'POST':
                for k in [k for k in G if k not in live]: del G[k]   # (guests who vanished without a word make room)
                if full: return out({ 'error': 'room full' }, code=409)
                R['next'] += 1; new = 'g%d' % R['next']
                G[new] = { 'hello': body, 'inq': [], 'seen': time.time() }; return out({ 'ok': True, 'gid': new })
            if u.path == '/net/hello': return out(None, b'[' + b','.join(b'{"gid":"' + k.encode() + b'","hello":' + g['hello'] + b'}' for k, g in live.items()) + b']')
            if u.path == '/net/in' and method == 'POST':
                g = G.get(gid)
                if not g: return out({ 'error': 'not in this room' }, code=410)
                g['seen'] = time.time(); g['inq'].append(body); g['inq'] = g['inq'][-60:]; return out({ 'ok': True })
            if u.path == '/net/in':
                parts = []
                for k, g in G.items(): parts.append(b'"' + k.encode() + b'":[' + b','.join(g['inq']) + b']'); g['inq'] = []
                return out(None, b'{' + b','.join(parts) + b'}')
            if u.path == '/net/snap' and method == 'POST': R['snap'] = body; return out({ 'ok': True })
            if u.path == '/net/snap': return out(None, R['snap'])
            if u.path == '/net/leave' and method == 'POST':
                if (q.get('who') or [''])[0] == 'guest': G.pop(gid, None)
                else: ROOMS.pop(room, None)
                return out({ 'ok': True })
        return out({ 'error': 'bad request' }, code=400)

    # A COPY OF THE SAVE ON DISK: the game keeps its save in the browser's storage, which has come back empty after app restarts.
    # Each save is also posted here and written to saves/slot_<port>.json (the previous one kept as .bak), and the game reads it
    # back when its own storage has no save. Keyed by port, so a test server (8767) never touches the real game's copy (8766).
    #   GET /save -> the last copy (404 when there is none) · POST /save {profile json} -> {ok}
    #   GET /save/list -> [{f, name, lv, gold, at}] this device's archived heroes, newest first · GET /save/archive?f=FILE -> one
    #   POST /save?keep=1 -> as POST /save, but the copy it replaces is always archived first (restoring an archived hero)
    #   POST /save/share {profile} -> {code} · GET /save/share?c=CODE -> that profile, once (&peek=1 only looks): MOVING A HERO
    #   (settings.js SEND HERO / GET HERO). Codes are 5 letters, last 30 minutes and are kept only in memory.
    def _save(self, method):
        import json, re, urllib.parse
        # one copy per device: this computer keeps slot_<port>.json; a phone or tablet playing over the home network gets its own
        # file, named for its address, so it can never overwrite the copy of the hero on this computer
        ip = self.client_address[0]; who = '' if ip in ('127.0.0.1', '::1', '::ffff:127.0.0.1') else '_' + ''.join(c if c.isalnum() else '_' for c in ip)
        port = self.server.server_address[1]; d = os.path.join(ROOT, 'saves'); f = os.path.join(d, 'slot_%d%s.json' % (port, who))
        a = os.path.join(d, 'archive', '%d%s' % (port, who))   # (each device's archived heroes in a folder of their own)
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        def out(b):
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
        if u.path == '/save/list':
            rows = []
            for x in (os.listdir(a) if os.path.isdir(a) else []):
                try: p = json.loads(open(os.path.join(a, x), 'rb').read()); rows.append({ 'f': x, 'name': (p.get('look') or {}).get('name') or 'hero', 'lv': p.get('lv') or 1, 'gold': p.get('gold') or 0, 'at': int(os.path.getmtime(os.path.join(a, x))) })
                except Exception: pass
            return out(json.dumps(sorted(rows, key=lambda r: -r['at'])).encode())
        if u.path == '/save/archive':
            x = (q.get('f') or [''])[0]
            if not re.fullmatch(r'[A-Za-z0-9_-]+_Lv\d+_\d{8}-\d{6}\.json', x) or not os.path.exists(os.path.join(a, x)): return self.send_error(404)
            return out(open(os.path.join(a, x), 'rb').read())
        if u.path == '/save/share':
            now = time.time()
            with SAVE_LOCK:
                for k in [k for k, v in SHARES.items() if v[1] < now]: SHARES.pop(k, None)
                if method == 'GET':
                    c = ((q.get('c') or [''])[0]).strip().upper(); v = SHARES.get(c) if (q.get('peek') or [''])[0] == '1' else SHARES.pop(c, None)   # (peek=1: look without using it up)
                    return out(v[0]) if v else self.send_error(404)
                n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n) if n else b''
                if len(body) < 50 or not body.startswith(b'{'): return self.send_error(400)
                import random
                if len(SHARES) >= SHARES_MAX: return self.send_error(503)
                code = ''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(5))
                SHARES[code] = (body, now + 1800)
            return out(json.dumps({ 'code': code }).encode())
        if method == 'GET':
            if not os.path.exists(f): return self.send_error(404)
            return out(open(f, 'rb').read())
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n) if n else b''
        if len(body) < 50 or not body.startswith(b'{'): return self.send_error(400)
        os.makedirs(d, exist_ok=True)
        with SAVE_LOCK:
            save_archive(f, a, body, force=(q.get('keep') or [''])[0] == '1')
            tmp = f + '.tmp'; open(tmp, 'wb').write(body)
            if os.path.exists(f): os.replace(f, f + '.bak')
            os.replace(tmp, f)
        b = b'{"ok": true}'; self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    # THE MARKET BOARD (js/market.js, 2026-11-19): players on this server list cards and gear for gold; anyone else here can buy them,
    # even while the seller is away. Kept in saves/market_<port>.json (a test server on another port has its own board).
    #   GET  /market/list                      -> { listings: [...], now }
    #   GET  /market/mine?mid=                 -> { earned, sold: [...], back: [...] }   (gold and returned items waiting)
    #   POST /market/post    { mid, sname, kind, item, price }  -> { ok, id }
    #   POST /market/buy     { mid, bname, id }                 -> { ok, item, kind, price }  |  { err }
    #   POST /market/cancel  { mid, id }                        -> { ok, item, kind }
    #   POST /market/collect { mid }                            -> { gold, sold: [...], back: [...] }  (then cleared)
    # Listings older than MARKET_DAYS go back to their seller (collected with the gold).
    def _market(self, method):
        import json, time, random, string, urllib.parse
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        n = int(self.headers.get('Content-Length') or 0)
        if n > 64 << 10: self.close_connection = True; return self.send_error(413)
        body = self.rfile.read(n) if n else b''
        def out(obj, code=200):
            b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
        port = self.server.server_address[1]; f = os.path.join(ROOT, 'saves', 'market_%d.json' % port)
        try: req = json.loads(body, parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c))) if body else {}   # (no NaN / Infinity)
        except Exception: return out({ 'err': 'bad request' }, 400)
        mid = str(req.get('mid') or (q.get('mid') or [''])[0])[:40]
        with MARKET_LOCK:
            global MARKET_MEM
            if KV_URL:   # (the hosted server: the board lives in the Upstash database, read once and kept in memory)
                if MARKET_MEM is None:
                    try: v = kv(['GET', 'zch_market'])
                    except Exception: return out({ 'err': 'The market is waking up: try again in a moment' }, 503)
                    MARKET_MEM = json.loads(v) if v else { 'listings': [], 'earned': {}, 'sold': {}, 'back': {} }
                M = MARKET_MEM
            else:
                try: M = json.loads(open(f, 'rb').read())
                except Exception: M = { 'listings': [], 'earned': {}, 'sold': {}, 'back': {} }
            now = int(time.time()); changed = False
            for L in [L for L in M['listings'] if now - L['at'] > MARKET_DAYS * 86400]:   # too old: back to its seller
                M['listings'].remove(L); M['back'].setdefault(L['seller'], []).append({ 'kind': L['kind'], 'item': L['item'] }); changed = True
            def save():
                if KV_URL:
                    try: kv(['SET', 'zch_market', json.dumps(M)])
                    except Exception as e: print('market not saved to the database:', e, flush=True)
                    return
                os.makedirs(os.path.dirname(f), exist_ok=True); tmp = f + '.tmp'
                with open(tmp, 'w', encoding='utf-8') as o: json.dump(M, o)
                os.replace(tmp, f)
            res = None
            # (each seller's id stays on the server: anyone holding it could collect their gold. The list says which are yours.)
            if u.path == '/market/list': res = { 'listings': [dict({ k: v for k, v in L.items() if k != 'seller' }, mine=bool(mid) and L['seller'] == mid) for L in M['listings']], 'now': now }
            elif u.path == '/market/mine': res = { 'earned': M['earned'].get(mid, 0), 'sold': M['sold'].get(mid, []), 'back': M['back'].get(mid, []) }
            elif method != 'POST' or not mid: res = ({ 'err': 'bad request' }, 400)
            elif u.path == '/market/post':
                kind, item, price = req.get('kind'), req.get('item'), req.get('price')
                if kind not in ('card', 'gear') or not isinstance(item, dict) or not isinstance(price, int) or not (1 <= price <= 10000000): res = ({ 'err': 'bad listing' }, 400)
                elif not market_item_ok(kind, item): res = ({ 'err': 'That is not a real item' }, 400)
                elif len(M['listings']) >= MARKET_ALL: res = { 'err': 'The market is full right now: try again later' }
                elif not market_post_ok(self.client_address[0], now): res = { 'err': 'Slow down a little: a few listings a minute' }
                elif sum(1 for L in M['listings'] if L['seller'] == mid) >= MARKET_MAX: res = { 'err': 'You can have %d listings at once' % MARKET_MAX }
                else:
                    lid = ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(10))
                    M['listings'].append({ 'id': lid, 'seller': mid, 'sname': market_name(req.get('sname')), 'kind': kind, 'item': item, 'price': price, 'at': now })
                    changed = True; res = { 'ok': True, 'id': lid }
            elif u.path in ('/market/buy', '/market/cancel'):
                L = next((L for L in M['listings'] if L['id'] == req.get('id')), None)
                if not L: res = { 'err': 'gone' }
                elif u.path == '/market/buy' and L['seller'] == mid: res = { 'err': 'That one is yours' }
                elif u.path == '/market/cancel' and L['seller'] != mid: res = { 'err': 'Not yours' }
                else:
                    M['listings'].remove(L); changed = True
                    if u.path == '/market/buy':
                        M['earned'][L['seller']] = M['earned'].get(L['seller'], 0) + L['price']
                        M['sold'].setdefault(L['seller'], []).append({ 'name': (L['item'].get('name') or L['item'].get('sp') or 'item'), 'kind': L['kind'], 'price': L['price'], 'buyer': market_name(req.get('bname'), 'someone'), 'at': now })
                    res = { 'ok': True, 'item': L['item'], 'kind': L['kind'], 'price': L['price'] }
            elif u.path == '/market/collect':
                res = { 'gold': M['earned'].pop(mid, 0), 'sold': M['sold'].pop(mid, []), 'back': M['back'].pop(mid, []) }; changed = True
            else: res = ({ 'err': 'unknown' }, 404)
            if changed: save()
        return out(*res) if isinstance(res, tuple) else out(res)

    def do_GET(self):
        if self._private(): return self.send_error(404)
        if self.path == '/health': b = b'ok'; self.send_response(200); self.send_header('Content-Length', '2'); self.end_headers(); self.wfile.write(b); return
        if self.path.startswith('/market/'): return self._market('GET')
        if self.path.startswith('/net/'): return self._net('GET')
        if self.path.split('?')[0] in ('/save', '/save/list', '/save/archive', '/save/share'): return self._save('GET')
        if self.path.split('?')[0] == '/cloud/save': return self._cloud('GET')
        if self.path.split('?')[0] == '/stats': return self._stats('GET')
        if self.path.split('?')[0] == '/photo/list': return self._photo_list()
        return super().do_GET()

    def _photo_list(self):
        # the ALBUM (js/photo.js): the newest photos first, by name (the pictures themselves are served as plain files from photos/)
        import json, re
        d = os.path.join(ROOT, 'photos')
        names = sorted((n for n in (os.listdir(d) if os.path.isdir(d) else []) if re.fullmatch(r'zenonia_\d{8}-\d{6}(_\d+)?\.jpg', n)), reverse=True)[:120]
        out = json.dumps(names).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)

    def do_POST(self):
        if self._private(): return self.send_error(404)
        if self._too_big(): return
        if self.path.startswith('/market/'): return self._market('POST')
        if self.path.startswith('/net/'): return self._net('POST')
        if self.path.split('?')[0] in ('/save', '/save/share'): return self._save('POST')
        if self.path.split('?')[0] == '/cloud/save': return self._cloud('POST')
        if self.path.split('?')[0] == '/stats/hello': return self._stats('POST')
        if self.path.split('?')[0] == '/photo': return self._photo()
        self.send_error(405)

    # ONLINE BACKUP (2026-11-20, js/cloudsave.js): the website's game and the phone app keep the hero only on that one device, so a
    # cleared browser or a lost phone lost it. Each device makes a private backup code (16 letters, never sent anywhere but here);
    # the hero is stored under a hash of it, so the database never holds the code itself, and kept 180 days after the last backup.
    #   POST /cloud/save?k=CODE {profile} -> {ok, at} · GET /cloud/save?k=CODE -> that hero (404 when there is none)
    # In Upstash on the hosted server (KV_URL), else in saves/cloud/ on this PC. One backup per code every 20 s at most.
    def _cloud(self, method):
        import json, re, hashlib, urllib.parse
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code = re.sub(r'[^A-Z0-9]', '', ((q.get('k') or [''])[0]).upper())
        if not re.fullmatch(r'[A-Z2-9]{16}', code): return self.send_error(400)
        h = hashlib.sha256(('zenonia-cloud:' + code).encode()).hexdigest(); key = 'cloud:' + h
        f = os.path.join(ROOT, 'saves', 'cloud', h + '.json')
        def out(b):
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
        if method == 'GET':
            try: body = (kv(['GET', key]) or '').encode() if KV_URL else (open(f, 'rb').read() if os.path.exists(f) else b'')
            except Exception: return self.send_error(503)
            return out(body) if body else self.send_error(404)
        n = int(self.headers.get('Content-Length') or 0)
        if n < 50 or n > CLOUD_MAX: self.close_connection = True; return self.send_error(413 if n else 400)
        body = self.rfile.read(n)
        try: p = json.loads(body)
        except Exception: return self.send_error(400)
        if not isinstance(p, dict) or not p.get('lv') or not isinstance(p.get('gear'), list): return self.send_error(400)
        now = time.time()
        with SAVE_LOCK:
            if now - CLOUD_LAST.get(h, 0) < 20: return self.send_error(429)
            CLOUD_LAST[h] = now
            if len(CLOUD_LAST) > 20000: CLOUD_LAST.clear()
        try:
            if KV_URL: kv(['SET', key, body.decode('utf-8'), 'EX', str(180 * 86400)])
            else:
                os.makedirs(os.path.dirname(f), exist_ok=True)
                with open(f, 'wb') as o: o.write(body)
        except Exception: return self.send_error(503)
        return out(json.dumps({ 'ok': 1, 'at': int(now * 1000) }).encode())

    # PLAYER COUNT (2026-11-20; the user: "next", the last idea on the list). The website's game and the phone app say hello once
    # each time they start (js/playcount.js) with a random id made on that device (not tied to a name, a save or anything else).
    # The server only adds a hash of it to a HyperLogLog per day and per platform, a counter that tells how many different ids
    # it has seen but cannot list them, and keeps those 35 days. /stats shows the numbers: today, the last 7 and 30 days, app or
    # website. In Upstash on the hosted server, in memory on a PC.
    def _stats(self, method):
        import json, re, hashlib, urllib.parse
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        day = lambda back=0: time.strftime('%Y%m%d', time.gmtime(time.time() - back * 86400))
        if method == 'POST':
            dev = (q.get('d') or [''])[0]; plat = (q.get('p') or [''])[0]
            if not re.fullmatch(r'[A-Za-z0-9]{12,40}', dev) or plat not in ('web', 'app'): return self.send_error(400)
            h = hashlib.sha256(('zenonia-count:' + dev).encode()).hexdigest()[:24]
            try:
                for key in ('stats:all:' + day(), 'stats:%s:%s' % (plat, day())):
                    if KV_URL: kv(['PFADD', key, h]); kv(['EXPIRE', key, str(35 * 86400)])
                    else: STATS_MEM.setdefault(key, set()).add(h)
            except Exception: return self.send_error(503)
            self.send_response(204); self.end_headers(); return
        def count(keys):
            if KV_URL: return int(kv(['PFCOUNT', *keys]) or 0)
            u = set();
            for k in keys: u |= STATS_MEM.get(k, set())
            return len(u)
        try:
            res = { 'today': count(['stats:all:' + day()]), 'last_7_days': count(['stats:all:' + day(i) for i in range(7)]),
                    'last_30_days': count(['stats:all:' + day(i) for i in range(30)]),
                    'today_app': count(['stats:app:' + day()]), 'today_website': count(['stats:web:' + day()]),
                    'days': { day(i): count(['stats:all:' + day(i)]) for i in range(14) }, 'note': 'different devices that opened the game (UTC days)' }
        except Exception: return self.send_error(503)
        b = json.dumps(res, indent=1).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def _photo(self):
        # PHOTO (F2 in the game, js/photo.js): a JPEG of the world, saved into the game folder's photos/ (this computer only)
        import time
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > 8 << 20:   # (an empty or too-large body is not read: the connection is closed instead)
            self.close_connection = True; return self.send_error(413)
        body = self.rfile.read(n)
        if self.client_address[0] not in ('127.0.0.1', '::1', '::ffff:127.0.0.1'): return self.send_error(403)
        if body[:3] != bytes([0xFF, 0xD8, 0xFF]): return self.send_error(400)   # (a JPEG only)
        d = os.path.join(ROOT, 'photos'); os.makedirs(d, exist_ok=True)
        name = 'zenonia_%s.jpg' % time.strftime('%Y%m%d-%H%M%S'); f = os.path.join(d, name); i = 2
        while os.path.exists(f): f = os.path.join(d, name[:-4] + '_%d.jpg' % i); i += 1
        with open(f, 'wb') as o: o.write(body)
        out = os.path.basename(f).encode()
        self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)


import threading, time
ROOMS, NET_LOCK, NET_IPS = {}, threading.Lock(), None
SHARES = {}   # (moving a hero: code -> (profile bytes, expiry), _save /save/share)
SAVE_LOCK = threading.Lock()
STATS_MEM = {}   # (player count on a PC: day key -> set of hashed ids; the hosted server keeps them in Upstash)
CLOUD_LAST, CLOUD_MAX = {}, 400 << 10   # (online backups: when each code last saved; the biggest hero accepted, 400 KB)
MARKET_LOCK, MARKET_DAYS, MARKET_MAX = threading.Lock(), 7, 20   # (the market board: one change at a time; listings last a week; 20 each)
MARKET_ALL, MARKET_POSTS = 600, {}   # (2026-11-20: at most 600 listings on the board; each address's recent post times)


# A SAFER MARKET (2026-11-20; js/marketcheck.js has the game's own, finer check). The server only knows the item's SHAPE, which is
# enough to keep out anything that could break the buyer's save: plain data (no deeper than 6, no list over 12, no more than 40
# keys, short strings, whole JSON under 12 KB), a rank 0-9, a card with a species name or a fusion of 2-4 such cards, and gear
# with a real slot and a stats table of plain numbers 0-100000.
def market_item_ok(kind, it):
    import json
    try: n = len(json.dumps(it))
    except Exception: return False
    if n > 12000: return False
    def plain(v, d=0):
        if d > 6: return False
        if v is None or isinstance(v, bool): return True
        if isinstance(v, (int, float)): return v == v and abs(v) < 1e9
        if isinstance(v, str): return len(v) <= 80
        if isinstance(v, list): return len(v) <= 12 and all(plain(x, d + 1) for x in v)
        if isinstance(v, dict): return len(v) <= 40 and all(isinstance(k, str) and len(k) <= 40 and k not in ('__proto__', 'constructor', 'prototype') and plain(x, d + 1) for k, x in v.items())
        return False
    rank = lambda t: isinstance(t, int) and not isinstance(t, bool) and 0 <= t <= 9
    def card(c, d=0):
        if not isinstance(c, dict) or not rank(c.get('tier')): return False
        f = c.get('fusion')
        if f: return d < 3 and isinstance(f, list) and 2 <= len(f) <= 4 and isinstance(c.get('name'), str) and all(card(x, d + 1) for x in f)
        return isinstance(c.get('sp'), str) and 0 < len(c['sp']) <= 12
    if not plain(it): return False
    if kind == 'card': return card(it)
    st = it.get('stats')
    return it.get('slot') in ('head', 'body', 'weapon', 'accessory', 'boots', 'trinket') and rank(it.get('tier')) and isinstance(st, dict) and         all(isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 100000 for v in st.values())


def market_name(v, dflt='hero'):   # a hero's name on the board: printable, 24 letters at most
    s = ''.join(ch for ch in str(v or '') if ch.isprintable())[:24].strip()
    return s or dflt


def market_post_ok(ip, now):   # a few listings a minute from one address (6), so nobody can flood the board
    L = [t for t in MARKET_POSTS.get(ip, []) if now - t < 60]
    if len(L) >= 6: MARKET_POSTS[ip] = L; return False
    L.append(now); MARKET_POSTS[ip] = L
    if len(MARKET_POSTS) > 5000: MARKET_POSTS.clear()
    return True


# A REPLACED HERO IS KEPT: when an incoming save looks like a different hero (another name) or a much weaker one (2+ levels
# lower: a New Game over the old hero), the copy on disk is archived first as saves/archive/<port><device>/<name>_Lv<lv>_<time>.json
# (the newest 30 are kept), so a hero replaced by mistake can still be brought back (the title's PREVIOUS HEROES: savearchive.js).
# force: always archive (a restore of an archived hero puts the current one away first).
def save_archive(f, a, body, force=False):
    import json, re, time, shutil
    if not os.path.exists(f): return
    try:
        old = json.loads(open(f, 'rb').read()); new = json.loads(body)
        name = lambda p: ((p.get('look') or {}).get('name') or 'hero')
        if not force and name(old) == name(new) and (old.get('lv') or 1) - (new.get('lv') or 1) < 2: return
        os.makedirs(a, exist_ok=True)
        safe = re.sub(r'[^A-Za-z0-9_-]+', '_', name(old))[:24] or 'hero'
        shutil.copyfile(f, os.path.join(a, '%s_Lv%d_%s.json' % (safe, old.get('lv') or 1, time.strftime('%Y%m%d-%H%M%S'))))
        keep = sorted(os.listdir(a), key=lambda x: os.path.getmtime(os.path.join(a, x)))
        for x in keep[:-30]: os.remove(os.path.join(a, x))
    except Exception:
        pass
# THE HOSTED SERVER (2026-11-19, Render's free plan): it keeps no files between restarts, so the market board is kept in a free
# Upstash Redis database instead, when Render passes its address and token (UPSTASH_REDIS_REST_URL / _TOKEN, set in Render's
# dashboard, never in this code). Without them the board is the saves/ file, as before.
KV_URL, KV_TOKEN = os.environ.get('UPSTASH_REDIS_REST_URL', '').rstrip('/'), os.environ.get('UPSTASH_REDIS_REST_TOKEN', '')
MARKET_MEM = None


def kv(cmd):   # one Redis command over Upstash's REST API, e.g. ['GET', key] -> its value
    import json, urllib.request
    r = urllib.request.Request(KV_URL, data=json.dumps(cmd).encode(), headers={ 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' })
    with urllib.request.urlopen(r, timeout=8) as x: return json.loads(x.read()).get('result')


ROOMS_MAX, SHARES_MAX = 300, 2000   # (public server: open rooms and waiting hero codes at once)
NET_GUESTS = 3   # (four players in a room: the host and three friends)


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256   # the game asks for ~300 images at once; the default backlog (5) dropped most of them
    daemon_threads = True


if not PUBLIC:   # (the public server gets a finished build; it has no art sources)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import build_pack
    if build_pack.stale(): build_pack.build()   # art changed since the pack was made

args = [a for a in sys.argv[1:] if not a.startswith('--')]
port = int(args[0]) if args else int(os.environ.get('PORT') or 8766)   # (Render says which port in $PORT)
host = '0.0.0.0' if '--lan' in sys.argv else '127.0.0.1'   # --lan: let other computers on your home network join online co-op
Server((host, port), functools.partial(NoCache, directory=os.path.join(ROOT, 'www') if PUBLIC else ROOT)).serve_forever()
