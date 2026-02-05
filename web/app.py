#!/usr/bin/env python3
import os
from typing import Any, Dict, Optional

import httpx
import asyncio
import yaml
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

APP_NAME = "LiteLLM Key Manager"

LITELLM_BASE_URL = os.getenv("LITELLM_BASE_URL", "http://ghc-proxy:4000")
MASTER_KEY = os.getenv("LITELLM_MASTER_KEY", "")
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
SESSION_SECRET = os.getenv("SESSION_SECRET", "change-me")

CONF_PATH = os.getenv("LITELLM_CONF_PATH", "/app/conf/copilot-config.yaml")

if not MASTER_KEY:
    import sys
    print("❌ LITELLM_MASTER_KEY is required")
    sys.exit(1)

app = FastAPI(title=APP_NAME)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


def _load_models():
    try:
        with open(CONF_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except FileNotFoundError:
        return []
    except Exception:
        return []

    models = []
    for item in data.get("model_list", []) or []:
        name = item.get("model_name") if isinstance(item, dict) else None
        if name:
            models.append(name)
    return models



def _is_logged_in(request: Request) -> bool:
    return bool(request.session.get("user"))


def _require_login(request: Request):
    if not _is_logged_in(request):
        raise HTTPException(status_code=401, detail="Not logged in")


async def _litellm_request(method: str, path: str, params=None, body=None):
    if not path.startswith("/"):
        path = "/" + path
    url = f"{LITELLM_BASE_URL}{path}"
    headers = {"Authorization": f"Bearer {MASTER_KEY}"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, url, params=params, json=body, headers=headers)
    if resp.status_code >= 400:
        try:
            content = resp.json()
        except Exception:
            content = {"error": resp.text or f"HTTP {resp.status_code}"}
        return JSONResponse(status_code=resp.status_code, content=content)
    try:
        return resp.json()
    except Exception:
        return resp.text


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "app_name": APP_NAME})


@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if username != ADMIN_USER or password != ADMIN_PASSWORD:
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "app_name": APP_NAME, "error": "Invalid credentials"},
            status_code=401,
        )
    request.session["user"] = username
    return RedirectResponse(url="/", status_code=303)


@app.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    if not _is_logged_in(request):
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse("index.html", {"request": request, "app_name": APP_NAME})


@app.get("/api/keys/list")
async def api_key_list(request: Request):
    _require_login(request)
    data = await _litellm_request("GET", "/key/list")
    if isinstance(data, JSONResponse):
        return data

    keys = []
    if isinstance(data, dict) and "keys" in data:
        keys = data.get("keys") or []
    elif isinstance(data, list):
        keys = data

    # If list already includes dicts, return as-is
    if keys and isinstance(keys[0], dict):
        return data

    # Load details for each key
    async with httpx.AsyncClient(timeout=30) as client:
        tasks = []
        for key in keys:
            if not isinstance(key, str):
                continue
            url = f"{LITELLM_BASE_URL}/key/info"
            tasks.append(
                client.get(url, params={"key": key}, headers={"Authorization": f"Bearer {MASTER_KEY}"})
            )
        results = await asyncio.gather(*tasks) if tasks else []

    detailed = []
    for resp in results:
        if resp.status_code >= 400:
            continue
        try:
            detailed.append(resp.json())
        except Exception:
            continue

    return {"keys": detailed, "total_count": len(detailed)}


@app.get("/api/keys/info")
async def api_key_info(request: Request, key: str):
    _require_login(request)
    return await _litellm_request("GET", "/key/info", params={"key": key})


@app.get("/api/keys/health")
async def api_key_health(request: Request, key: Optional[str] = None):
    _require_login(request)
    params = {"key": key} if key else None
    return await _litellm_request("GET", "/key/health", params=params)


@app.post("/api/keys/generate")
async def api_key_generate(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/generate", body=body)


@app.post("/api/keys/service-account/generate")
async def api_service_account_generate(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/service-account/generate", body=body)


@app.post("/api/keys/update")
async def api_key_update(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/update", body=body)


@app.post("/api/keys/delete")
async def api_key_delete(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/delete", body=body)


@app.post("/api/keys/regenerate")
async def api_key_regenerate(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/regenerate", body=body)


@app.post("/api/keys/block")
async def api_key_block(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/block", body=body)


@app.post("/api/keys/unblock")
async def api_key_unblock(request: Request):
    _require_login(request)
    body = await request.json()
    return await _litellm_request("POST", "/key/unblock", body=body)


@app.get("/api/ping")
async def api_ping(request: Request):
    _require_login(request)
    return {"status": "ok"}


@app.get("/api/models")
async def api_models(request: Request):
    _require_login(request)
    return {"models": _load_models()}
