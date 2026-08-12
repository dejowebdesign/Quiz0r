// Runtime verification for the AI provider migration + certificate bug fix.
// Uses FreeLLMAPI (mock) + real socket.io + real DB. Throwaway test helper.
import { io as ioc } from "socket.io-client";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";

function getCookieHeader() {
  const text = readFileSync("/tmp/admin-cookies.txt", "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines
    .filter((l) => l.includes("quiz0r_admin_session"))
    .map((l) => {
      const parts = l.split("\t");
      return `${parts[parts.length - 2]}=${parts[parts.length - 1]}`;
    })
    .join("; ");
}

void readFileSync;

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

async function createQuiz() {
  const { json } = await api("/api/quizzes/ai-generate", {
    method: "POST",
    body: JSON.stringify({ topic: "Certs", difficulty: "easy", questionCount: 2, sectionCount: 1 }),
  });
  return json.quizId;
}

async function joinPlayer(gameCode, name) {
  return new Promise((resolve) => {
    const sock = ioc(`${BASE}`, { transports: ["websocket"] });
    sock._name = name;
    sock.on("connect", () => {
      sock.emit("player:join", { gameCode, name, languageCode: "en" });
    });
    sock.on("game:state", (state) => {
      if (state?.playerId) {
        sock.playerId = state.playerId;
        resolve(sock);
      } else {
        // store and resolve after short delay
        sock.playerId = state?.playerId;
        setTimeout(() => resolve(sock), 500);
      }
    });
    sock.on("error", (e) => log("player error:", e?.message));
    setTimeout(() => resolve(sock), 5000);
  });
}

async function hostReady(gameCode) {
  return new Promise((resolve) => {
    const sock = ioc(`${BASE}`, {
      transports: ["websocket"],
      extraHeaders: { Cookie: getCookieHeader() },
    });
    sock.on("connect", () => {
      sock.emit("host:joinRoom", { gameCode });
    });
    sock.on("game:state", () => resolve(sock));
    sock.on("error", (e) => log("host error:", e?.message));
    setTimeout(() => resolve(sock), 5000);
  });
}

async function waitFor(sock, event, ms = 8000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    sock.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

const log = (...a) => console.log(...a);

async function main() {
  // 1. congrats message via provider (direct call through HTTP? use ai-generate route proxy? No direct route.)
  // Instead verify congrats indirectly via certificate generation below.

  const quizId = await createQuiz();
  log("quizId:", quizId);

  const { json: session } = await api("/api/games", {
    method: "POST",
    body: JSON.stringify({ quizId }),
  });
  const gameCode = session.gameCode;
  log("gameCode:", gameCode);

  const host = await hostReady(gameCode);

  // join 3 players
  const players = [];
  for (const name of ["P1", "P2", "P3"]) {
    const p = await joinPlayer(gameCode, name);
    players.push(p);
    log("joined:", name, p.playerId);
  }
  // Resolve player IDs via the game state API (game:state doesn't include id)
  const { json: gs1 } = await api(`/api/games/${gameCode}`);
  const apiPlayers = gs1.players || gs1.gameSession?.players || [];
  for (const p of players) {
    const found = apiPlayers.find((pl) => pl.name === p._name);
    if (found) p.playerId = found.id;
  }

  // start game (auto-admit? check). If not auto-admitted, admit manually.
  const { json: gs0 } = await api(`/api/games/${gameCode}`);
  if (gs0.autoAdmit === false) {
    for (const p of players) {
      if (p.playerId) host.emit("host:admitPlayer", { gameCode, playerId: p.playerId });
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  host.emit("host:startGame", { gameCode });
  await waitFor(host, "game:questionStart");
  log("game started");

  // Drive through all questions: answer -> reveal -> scoreboard -> next
  for (let i = 0; i < 20; i++) {
    const q = await waitFor(host, "game:questionStart", 6000);
    if (!q) break;
    const isSection = q.question?.questionType === "SECTION";
    log("question", i, q.question?.questionType, "idx", q.questionIndex);
    if (!isSection) {
      // players submit answers
      const firstAnswerId = q.question?.answers?.[0]?.id;
      for (const p of players) {
        p.emit("player:answer", { gameCode, questionId: q.question.id, answerIds: firstAnswerId ? [firstAnswerId] : [] });
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    host.emit("host:revealAnswers", { gameCode });
    await waitFor(host, "game:questionEnd", 4000);
    await new Promise((r) => setTimeout(r, 200));
    host.emit("host:showScoreboard", { gameCode });
    await waitFor(host, "game:scoreUpdate", 4000);
    await new Promise((r) => setTimeout(r, 200));
    host.emit("host:nextQuestion", { gameCode });
  }

  // end the game
  host.emit("host:endGame", { gameCode });
  const finished = await waitFor(host, "game:finished", 10000);
  log("game:finished received:", !!finished, "winners:", finished?.winners?.length);

  // simulate disconnect race: disconnect 1-2 players immediately (sets isActive=false)
  if (players[0]) players[0].disconnect();
  if (players[1]) players[1].disconnect();
  log("disconnected 2 players to trigger the race");

  // wait for certificate generation
  let certs = null;
  for (let i = 0; i < 30; i++) {
    const { json: c } = await api(`/api/games/${gameCode}/certificates/status`);
    certs = c;
    if (c.completed + c.failed === c.total && c.total > 0) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  log("=== CERTIFICATE STATUS ===");
  log("total:", certs.total, "completed:", certs.completed, "failed:", certs.failed);
  for (const c of certs.certificates) {
    log(`  ${c.type} ${c.playerName || ""}: ${c.status}${c.errorMessage ? " - " + c.errorMessage : ""}`);
  }

  const allCompleted = certs.total > 0 && certs.failed === 0 && certs.completed === certs.total;
  log("\nRESULT:", allCompleted ? "PASS - all certificates completed" : "FAIL - some certificates failed");

  // verify download works for a player cert
  const playerCert = certs.certificates.find((c) => c.type === "player" && c.status === "completed");
  if (playerCert) {
    const dl = await fetch(`${BASE}/api/games/${gameCode}/certificates/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "player", playerId: playerCert.playerId }),
    });
    log("download status:", dl.status, "type:", dl.headers.get("content-type"));
    log("DOWNLOAD:", dl.status === 200 ? "PASS" : "FAIL");
  }

  // cleanup sockets
  for (const p of players) try { p.disconnect(); } catch {}
  try { host.disconnect(); } catch {}

  process.exit(0);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
