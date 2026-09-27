#!/usr/bin/env python3
# Test E2E de la messagerie (parité WhatsApp pro : DM, groupes, réactions, typing,
# épinglage, pièces jointes, sécurité des fichiers, masquage super admin).
import base64
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request

BASE = "http://localhost:4000"
DB_FILE = "/home/user/adiong/server/data/adiong.db"
OK = 0
KO = 0
FAILS = []

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
AUDIO_BYTES = b"\x49\x44\x33\x03\x00\x00\x00\x00\x00\x00\x00" + b"\x00" * 48


def check(name, cond, extra=""):
    global OK, KO
    if cond:
        OK += 1
        print(f"  OK   {name}")
    else:
        KO += 1
        FAILS.append(name + (f" — {extra}" if extra else ""))
        print(f"  KO   {name} {extra}")


def call(method, path, body=None, token=None, headers=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8", errors="replace")
            return r.status, (json.loads(raw) if raw.lstrip()[:1] in "{[" else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:200]}


def call_multipart(method, path, fields, file_field, filename, content, mime, token):
    boundary = "----e2e" + str(int(time.time() * 1000))
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append(
        (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\n"
         f"Content-Type: {mime}\r\n\r\n").encode() + content + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(BASE + path, data=b"".join(parts), method=method)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode("utf-8", errors="replace")
            return r.status, json.loads(raw) if raw.lstrip()[:1] == "{" else raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:200]}


def main():
    global OK, KO
    stamp = str(int(time.time()))[-6:]
    email2 = f"e2e.util2.{stamp}@adiong.org"
    email3 = f"e2e.util3.{stamp}@adiong.org"
    PASS = "E2Echat123!"

    print("== Setup ==")
    s, b = call("POST", "/api/auth/login", {"email": "admin@adiong.org", "password": "AdiOng2026!"})
    check("login super admin", s == 200 and b.get("token"), f"status={s}")
    T = b.get("token")
    s, mods = call("GET", "/api/admin/modules", token=T)
    check("modules 200", s == 200, f"status={s}")
    orig_chat = mods.get("chat_enabled", True)
    if not orig_chat:
        call("PUT", "/api/admin/modules", {"chat_enabled": True}, token=T)

    s, u2 = call("POST", "/api/admin/users", {
        "email": email2, "password": PASS, "full_name": "Utilisateur Deux", "role": "admin", "job_title": "Comptable"
    }, token=T)
    check("création utilisateur 2 (admin)", s in (200, 201) and u2.get("id"), f"status={s} {u2}")
    s, u3 = call("POST", "/api/admin/users", {
        "email": email3, "password": PASS, "full_name": "Utilisateur Trois", "role": "editor", "job_title": "Rédacteur"
    }, token=T)
    check("création utilisateur 3 (editor)", s in (200, 201) and u3.get("id"), f"status={s} {u3}")
    id2, id3 = u2.get("id"), u3.get("id")

    s, b = call("POST", "/api/auth/login", {"email": email2, "password": PASS})
    T2 = b.get("token")
    s, b = call("POST", "/api/auth/login", {"email": email3, "password": PASS})
    T3 = b.get("token")
    check("logins des deux utilisateurs", bool(T2 and T3))

    cid = gid = None
    try:
        print("== Masquage super admin ==")
        s, staff_t = call("GET", "/api/chat/staff", token=T)
        check("staff (super admin voit tout)", s == 200 and any(x.get("email") == "admin@adiong.org" for x in staff_t), f"status={s}")
        s, staff_2 = call("GET", "/api/chat/staff", token=T2)
        check("staff (super admin masqué aux autres)", s == 200 and not any(x.get("email") == "admin@adiong.org" for x in staff_2), f"status={s}")

        print("== Discussion directe (DM) ==")
        s, c = call("POST", "/api/chat/dm", {"user_id": id3}, token=T2)
        check("DM créée", s == 200 and c.get("id") and c.get("type") == "dm", f"status={s} {c}")
        cid = c.get("id")
        s, c2 = call("POST", "/api/chat/dm", {"user_id": id2}, token=T3)
        check("DM existante (déduplication)", s == 200 and c2.get("id") == cid, f"status={s}")
        s, _ = call("POST", "/api/chat/dm", {"user_id": id2}, token=T2)
        check("DM avec soi-même refusée", s == 400, f"status={s}")
        s, _ = call("POST", "/api/chat/dm", {"user_id": 999999}, token=T2)
        check("DM avec inconnu 404", s == 404, f"status={s}")
        s, convs = call("GET", "/api/chat/conversations", token=T3)
        check("conversation listée chez le destinataire", s == 200 and any(x.get("id") == cid for x in convs), f"status={s}")

        s, m1 = call("POST", f"/api/chat/{cid}/messages", {"body": "Bonjour T3 — premier message"}, token=T2)
        check("message envoyé", s == 200 and m1.get("id"), f"status={s} {m1}")
        mid1 = m1.get("id")
        s, _ = call("POST", f"/api/chat/{cid}/messages", {"body": "   "}, token=T2)
        check("message vide refusé", s == 400, f"status={s}")

        s, un = call("GET", "/api/chat/unread", token=T3)
        check("non-lus ≥ 1 chez T3", s == 200 and un.get("count", 0) >= 1, f"{un}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        msgs = det.get("messages", []) if s == 200 else []
        check("message reçu par T3", s == 200 and len(msgs) == 1 and "premier message" in (msgs[0].get("body") or ""), f"status={s}")
        check("nom de l'expéditeur visible", msgs and msgs[0].get("sender_name") == "Utilisateur Deux", f"{msgs and msgs[0].get('sender_name')}")
        s, un = call("GET", "/api/chat/unread", token=T3)
        check("non-lus remis à 0 après lecture", s == 200 and un.get("count", 0) == 0, f"{un}")

        s, m2 = call("POST", f"/api/chat/{cid}/messages", {"body": "Salut, réponse au message", "reply_to": mid1}, token=T3)
        check("réponse (reply) envoyée", s == 200 and m2.get("id"), f"status={s} {m2}")
        mid2 = m2.get("id")
        s, det = call("GET", f"/api/chat/{cid}", token=T2)
        rep = next((m for m in det.get("messages", []) if m.get("id") == mid2), {}) if s == 200 else {}
        check("réponse liée au message d'origine", rep.get("reply_to") == mid1 and "premier message" in (rep.get("reply_body") or ""), f"{rep.get('reply_body')}")
        s, _ = call("POST", f"/api/chat/{cid}/messages", {"body": "rép. invalide", "reply_to": 999999}, token=T2)
        check("réponse à un message inexistant refusée", s == 400, f"status={s}")

        s, ed = call("PUT", f"/api/chat/messages/{mid1}", {"body": "Bonjour T3 — message modifié"}, token=T2)
        check("édition de son propre message", s == 200 and ed.get("edited_at"), f"status={s}")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}", {"body": "piétinement"}, token=T3)
        check("édition d'un message d'autrui refusée", s == 403, f"status={s}")

        print("== Réactions ==")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}/react", {"emoji": "👍"}, token=T2)
        check("réaction 👍 posée", s == 200, f"status={s}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        msg1 = next((m for m in det.get("messages", []) if m.get("id") == mid1), {})
        reac = msg1.get("reactions") or []
        check("réaction visible (1, pas la mienne)", len(reac) == 1 and reac[0].get("emoji") == "👍" and reac[0].get("count") == 1 and not reac[0].get("mine"), f"{reac}")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}/react", {"emoji": "❤️"}, token=T2)
        check("changement de réaction (remplace)", s == 200, f"status={s}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        msg1 = next((m for m in det.get("messages", []) if m.get("id") == mid1), {})
        reac = msg1.get("reactions") or []
        check("une seule réaction (❤️)", len(reac) == 1 and reac[0].get("emoji") == "❤️", f"{reac}")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}/react", {"emoji": "❤️"}, token=T2)
        check("même réaction → retirée", s == 200, f"status={s}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        msg1 = next((m for m in det.get("messages", []) if m.get("id") == mid1), {})
        check("réaction retirée (vide)", len(msg1.get("reactions") or []) == 0, f"{msg1.get('reactions')}")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}/react", {"emoji": "🚀"}, token=T2)
        check("emoji non autorisé ignoré", s == 200, f"status={s}")

        print("== Typing & mute ==")
        s, _ = call("POST", f"/api/chat/{cid}/typing", {}, token=T2)
        check("typing signalé", s == 200, f"status={s}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        check("typing visible chez T3", s == 200 and (det.get("typing") or {}).get("name") == "Utilisateur Deux", f"{det.get('typing')}")
        s, mut = call("PUT", f"/api/chat/conversations/{cid}/mute", {"muted": True}, token=T3)
        check("mute activé", s == 200 and mut.get("muted") is True, f"status={s} {mut}")
        s, _ = call("PUT", f"/api/chat/conversations/{cid}/mute", {"muted": False}, token=T3)
        check("mute désactivé", s == 200, f"status={s}")

        print("== Épinglage ==")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}/pin", {}, token=T2)
        check("message épinglé", s == 200, f"status={s}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        check("épingle visible chez T3", s == 200 and any(p.get("id") == mid1 for p in det.get("pins", [])), f"pins={det.get('pins')}")
        s, _ = call("PUT", f"/api/chat/messages/{mid1}/pin", {}, token=T2)
        check("désépinglage", s == 200, f"status={s}")

        print("== Pièces jointes & sécurité fichiers ==")
        s, up = call_multipart("POST", "/api/chat/upload", {}, "file", "e2e-photo.png", PNG_1PX, "image/png", T2)
        check("upload image", s == 200 and str(up.get("url", "")).startswith("/uploads/chat/"), f"status={s} {up}")
        furl = up.get("url", "")
        fname = furl.rsplit("/", 1)[-1]
        s, _ = call("GET", furl, token=None)
        check("fichier chat sans token → 401", s == 401, f"status={s}")
        s, _ = call("GET", furl, token=T2)
        check("fichier non attaché à un message → 404", s == 404, f"status={s}")
        s, _ = call("GET", "/uploads/chat/..%2F..%2F..%2Fserver%2Findex.js", token=T2)
        check("traversée de chemin bloquée", s in (401, 403, 404), f"status={s}")

        s, m3 = call_multipart("POST", f"/api/chat/{cid}/messages", {"body": "note vocale"}, "file", "e2e-note.mp3", AUDIO_BYTES, "audio/mpeg", T3)
        check("message vocal envoyé", s == 200 and m3.get("id"), f"status={s} {m3}")
        s, det = call("GET", f"/api/chat/{cid}", token=T2)
        msg3 = next((m for m in det.get("messages", []) if m.get("id") == m3.get("id")), {}) if s == 200 else {}
        check("pièce jointe audio enregistrée", bool(msg3.get("attachment") and msg3.get("attachment_name") == "e2e-note.mp3"), f"{msg3.get('attachment')}")
        check("dernier message = libellé vocal", "vocal" in (det.get("conversation", {}).get("last_message_body") or ""), f"{det.get('conversation', {}).get('last_message_body')}")
        s, _ = call("GET", msg3.get("attachment", ""), token=T3)
        check("fichier du message accessible au membre", s == 200, f"status={s}")
        s, _ = call("GET", msg3.get("attachment", ""), token=T)
        check("fichier du message (non-membre) → 404", s == 404, f"status={s}")

        print("== Suppressions ==")
        s, _ = call("DELETE", f"/api/chat/messages/{mid1}", token=T3)
        check("suppression d'un message d'autrui (membre) refusée", s == 403, f"status={s}")
        s, _ = call("DELETE", f"/api/chat/messages/{mid1}", token=T2)
        check("suppression de son message", s == 200, f"status={s}")
        s, det = call("GET", f"/api/chat/{cid}", token=T3)
        msg1 = next((m for m in det.get("messages", []) if m.get("id") == mid1), {})
        check("message marqué supprimé", bool(msg1.get("deleted_at")), f"{msg1.get('deleted_at')}")

        print("== Groupes ==")
        s, g = call("POST", "/api/chat/groups", {"name": f"Groupe E2E {stamp}", "description": "groupe de test", "join_policy": "ouvert", "member_ids": [id2]}, token=T)
        check("groupe créé (propriétaire super admin)", s == 200 and g.get("id"), f"status={s} {g}")
        gid = g.get("id")
        s, og = call("GET", "/api/chat/open-groups", token=T3)
        check("groupe ouvert listé", s == 200 and isinstance(og, list) and any(x.get("id") == gid for x in og), f"status={s}")
        s, _ = call("POST", f"/api/chat/groups/{gid}/join", {}, token=T3)
        check("T3 rejoint le groupe", s == 200, f"status={s}")
        s, _ = call("POST", f"/api/chat/groups/{gid}/join", {}, token=T3)
        check("re-double-adhésion refusée", s == 409, f"status={s}")
        s, gm = call("POST", f"/api/chat/{gid}/messages", {"body": f"message groupe e2e {stamp}"}, token=T2)
        check("message dans le groupe", s == 200 and gm.get("id"), f"status={s} {gm}")
        s, det = call("GET", f"/api/chat/{gid}", token=T)
        check("message groupe visible par le propriétaire", s == 200 and any("message groupe e2e" in (m.get("body") or "") for m in det.get("messages", [])), f"status={s}")
        s, _ = call("POST", f"/api/chat/conversations/{gid}/members", {"user_id": id3}, token=T)
        check("T3 ajouté par le propriétaire (déjà membre) → 409", s == 409, f"status={s}")
        s, mem = call("GET", f"/api/chat/conversations/{gid}/members", token=T)
        check("3 membres listés (vue super admin)", s == 200 and len(mem) == 3, f"n={len(mem) if isinstance(mem, list) else mem}")
        s, mem = call("GET", f"/api/chat/conversations/{gid}/members", token=T3)
        check("super admin masqué dans la liste (vue membre)", s == 200 and len(mem) == 2, f"n={len(mem) if isinstance(mem, list) else mem}")
        s, _ = call("PUT", f"/api/chat/conversations/{gid}/members/{id2}", {"role": "moderateur"}, token=T)
        check("T2 promu modérateur", s == 200, f"status={s}")
        s, _ = call("PUT", f"/api/chat/conversations/{gid}/members/{id3}", {"role": "moderateur"}, token=T2)
        check("changement de rôle refusé (non propriétaire)", s == 403, f"status={s}")
        s, _ = call("PUT", f"/api/chat/conversations/{gid}", {"name": f"Groupe E2E {stamp} v2"}, token=T2)
        check("renommage du groupe (modérateur)", s == 200, f"status={s}")
        s, res = call("GET", f"/api/chat/search?q=message%20groupe%20e2e", token=T2)
        found = json.dumps(res) if s == 200 else ""
        check("recherche de message", s == 200 and (f"Groupe E2E {stamp}" in found or "message groupe e2e" in found), f"status={s}")
        s, _ = call("DELETE", f"/api/chat/conversations/{gid}", token=T2)
        check("suppression du groupe refusée (non propriétaire)", s == 403, f"status={s}")

        print("== Module désactivé ==")
        call("PUT", "/api/admin/modules", {"chat_enabled": False}, token=T)
        s, _ = call("GET", "/api/chat/conversations", token=T2)
        check("chat désactivé → 403", s == 403, f"status={s}")
        call("PUT", "/api/admin/modules", {"chat_enabled": True}, token=T)
        s, _ = call("GET", "/api/chat/conversations", token=T2)
        check("chat réactivé → 200", s == 200, f"status={s}")
    finally:
        print("== Nettoyage ==")
        if gid:
            try:
                call("DELETE", f"/api/chat/conversations/{gid}", token=T)
            except Exception:
                pass
        if cid:
            try:
                con = sqlite3.connect(DB_FILE, timeout=10)
                cur = con.cursor()
                cur.execute("BEGIN")
                cur.execute(f"DELETE FROM chat_messages WHERE conversation_id = {int(cid)}")
                cur.execute(f"DELETE FROM chat_pins WHERE conversation_id = {int(cid)}")
                cur.execute(f"DELETE FROM chat_reads WHERE conversation_id = {int(cid)}")
                cur.execute(f"DELETE FROM chat_members WHERE conversation_id = {int(cid)}")
                cur.execute(f"DELETE FROM chat_conversations WHERE id = {int(cid)}")
                con.commit()
                con.close()
                print("  OK   DM de test supprimée (base)")
                OK += 1
            except Exception as e:
                KO += 1
                FAILS.append(f"nettoyage DM — {e}")
                print(f"  KO   nettoyage DM — {e}")
        for uid in (id2, id3):
            s, _ = call("DELETE", f"/api/admin/users/{uid}", token=T)
            check(f"utilisateur {uid} supprimé", s == 200, f"status={s}")
        if not orig_chat:
            call("PUT", "/api/admin/modules", {"chat_enabled": False}, token=T)

    print(f"\n==== RÉSULTAT : {OK} OK / {KO} KO ====")
    if FAILS:
        print("Échecs :")
        for f in FAILS:
            print("  -", f)
    return 1 if KO else 0


if __name__ == "__main__":
    sys.exit(main())
