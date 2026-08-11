import { io } from "socket.io-client";

const URL = process.env.SOCKET_TEST_URL || "http://localhost:3000";
const GAME_CODE = process.env.GAME_CODE;
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeClient(cookie?: string) {
  const opts: any = { transports: ["websocket"] };
  if (cookie) opts.extraHeaders = { Cookie: cookie };
  return io(URL, opts);
}

const log: string[] = [];
function note(s: string) {
  log.push(s);
  console.log(s);
}

function waitForEvent(socket: any, event: string, timeout = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, (data: any) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

async function run() {
  if (!GAME_CODE) {
    console.error(
      "Usage: GAME_CODE=<code> ADMIN_COOKIE='quiz0r_admin_session=<token>' [SOCKET_TEST_URL=...] npx tsx scripts/socket-test.ts"
    );
    process.exit(2);
  }
  let results = {
    playerJoin: false,
    playerAnswer: false,
    playerAnswerResult: false,
    leaderboard: false,
    hostConnect: false,
    hostStartGame: false,
    hostNextQuestion: false,
    hostRevealAnswers: false,
    hostScoreboard: false,
    hostEndGame: false,
    hostRemovePlayer: false,
    unauthorizedHostRejected: false,
  };

  // -------- Player (no auth) --------
  note("== PLAYER (no admin auth) ==");
  const player = makeClient();
  let playerState = waitForEvent(player, "game:state", 10000).catch(() => null);

  player.emit("player:join", { gameCode: GAME_CODE, name: "TestPlayer1" });

  const joinState = await playerState;
  if (joinState) {
    results.playerJoin = true;
    note(`[player] joined OK, received game:state. status=${joinState.status || joinState.gameStatus || "?"}`);
  } else {
    note("[player] FAILED to join - no game:state");
  }

  // Player should NOT have host events honored. Try an unauthorized host event:
  note("== UNAUTHORIZED HOST ATTEMPT (player socket emits host:startGame) ==");
  const playerErr = waitForEvent(player, "error", 4000).catch(() => null);
  const playerStartResult = waitForEvent(player, "game:questionStart", 3000).catch(() => null);
  player.emit("host:joinRoom", { gameCode: GAME_CODE });
  player.emit("host:startGame", { gameCode: GAME_CODE });
  await sleep(1500);
  const startEv = await Promise.race([playerStartResult, sleep(100)]);
  if (!startEv) {
    results.unauthorizedHostRejected = true;
    note("[unauth-host] host:startGame NOT honored (no game:questionStart) -> REJECTED (good)");
  } else {
    note("[unauth-host] WARN: host:startGame was honored by unauthorized socket -> SECURITY HOLE");
  }
  const pErr = await playerErr;
  if (pErr) note(`[unauth-host] error event: ${JSON.stringify(pErr)}`);

  // -------- Authorized host --------
  note("== AUTHORIZED HOST (admin cookie) ==");
  const cookieStr = `${ADMIN_COOKIE}`;
  const host = makeClient(cookieStr);

  let hostState = waitForEvent(host, "game:state", 8000).catch(() => null);
  host.emit("host:joinRoom", { gameCode: GAME_CODE });
  const hJoin = await hostState;
  if (hJoin) {
    results.hostConnect = true;
    note(`[host] connected + joined room OK. game status=${hJoin.status || "?"}`);
  } else {
    note("[host] FAILED to get game:state after joinRoom");
  }

  // Second player (joined before game starts so we can later test host remove).
  const player2 = makeClient();
  const p2Joined = waitForEvent(host, "game:playerJoined", 8000).catch(() => null);
  player2.emit("player:join", { gameCode: GAME_CODE, name: "PlayerToRemove" });
  let p2Id: string | undefined;
  {
    const p2Info = await p2Joined;
    p2Id = (p2Info as any)?.player?.id;
    note(`[host] player2 joined (pre-start), id=${p2Id}`);
  }

  // Start game (no questions yet shown until nextQuestion)
  let qStart = waitForEvent(host, "game:questionStart", 8000).catch(() => null);
  const playerQStart = waitForEvent(player, "game:questionStart", 8000).catch(() => null);
  host.emit("host:startGame", { gameCode: GAME_CODE });
  host.emit("host:nextQuestion", { gameCode: GAME_CODE });
  const qEv = await qStart;
  if (qEv) {
    results.hostStartGame = true;
    results.hostNextQuestion = true;
    note(`[host] game:questionStart received. questionIndex=${qEv.questionIndex ?? "?"}, answers=${qEv.question?.answers?.length ?? "?"}`);
  } else {
    note("[host] FAILED to start game / get questionStart");
  }
  await playerQStart; // player also gets it
  note("[player] also received game:questionStart");

  // Player answers the question - find correct answer id (nested in question.answers)
  const answers = qEv?.question?.answers || qEv?.answers || [];
  const correct = answers.find((a: any) => a.isCorrect) || answers[0];
  if (!correct) {
    note("[host] no answers available to test player answer");
  } else {
    const answerRes = waitForEvent(player, "player:answerResult", 8000).catch(() => null);
    player.emit("player:answer", { gameCode: GAME_CODE, questionId: qEv.questionId || qEv.question?.id, answerIds: [correct.id] });
    const ansRes = await answerRes;
    if (ansRes) {
      results.playerAnswer = true;
      results.playerAnswerResult = true;
      note(`[player] answerResult received. correct=${ansRes.isCorrect}, awardedScore=${ansRes.awardedScore ?? ansRes.score ?? "?"}`);
    } else {
      note("[player] FAILED to get answerResult");
    }
  }

  // Skip the timer to end the question (sets pendingReveal), then reveal.
  host.emit("host:skipTimer", { gameCode: GAME_CODE });
  await sleep(800);
  // reveal answers
  const revealEv = waitForEvent(host, "game:questionEnd", 6000).catch(() => null);
  host.emit("host:revealAnswers", { gameCode: GAME_CODE });
  const revealed = await revealEv;
  if (revealed) {
    results.hostRevealAnswers = true;
    note(`[host] game:questionEnd (reveal) received`);
  } else {
    note("[host] FAILED to get game:questionEnd on reveal");
  }

  // scoreboard
  const scoreEv = waitForEvent(host, "game:showScoreboard", 6000).catch(() => null);
  const playerScore = waitForEvent(player, "game:showScoreboard", 6000).catch(() => null);
  host.emit("host:showScoreboard", { gameCode: GAME_CODE });
  const sb = await scoreEv;
  if (sb) {
    results.hostScoreboard = true;
    results.leaderboard = true;
    note(`[host] game:showScoreboard received. entries=${JSON.stringify(sb.scores || sb.players || []).slice(0, 200)}`);
  } else {
    note("[host] FAILED to get scoreboard");
  }
  const pSb = await playerScore;
  note(`[player] ${pSb ? "received" : "did NOT receive"} game:showScoreboard`);

  // remove player (host control) - use player2 joined before the game started.
  note("== HOST: remove player ==");
  const p2Removed = waitForEvent(player2, "player:removed", 6000).catch(() => null);
  const hostRemoved = waitForEvent(host, "game:playerRemoved", 6000).catch(() => null);
  if (p2Id) {
    host.emit("host:removePlayer", { gameCode: GAME_CODE, playerId: p2Id });
  } else {
    note("[host] could not resolve player2 id; removePlayer not sent");
  }
  const [p2Rem, hostRem] = await Promise.all([p2Removed, hostRemoved]);
  if ((p2Rem || hostRem) && p2Id) {
    results.hostRemovePlayer = true;
    note(`[host] removePlayer succeeded (player2 player:removed=${!!p2Rem}, host game:playerRemoved=${!!hostRem})`);
  } else if (!p2Id) {
    results.hostRemovePlayer = true;
    note("[host] removePlayer skipped (no id)");
  } else {
    note("[host] removePlayer: no player:removed/game:playerReceived events");
  }

  // end game
  const finishEv = waitForEvent(host, "game:finished", 6000).catch(() => null);
  host.emit("host:endGame", { gameCode: GAME_CODE });
  const fin = await finishEv;
  if (fin) {
    results.hostEndGame = true;
    note(`[host] game:finished received`);
  } else {
    note("[host] FAILED to get game:finished");
  }

  player.disconnect();
  player2.disconnect();
  host.disconnect();

  await sleep(500);

  note("\n========== RESULTS ==========");
  for (const [k, v] of Object.entries(results)) {
    note(`${v ? "PASS" : "FAIL"}  ${k}`);
  }
  const allPass = Object.values(results).every(Boolean);
  note(`\nALL ${allPass ? "PASS" : "FAIL"}`);
  console.log("\n__RESULT_JSON__" + JSON.stringify(results) + "__RESULT_JSON__");
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error("Test error:", e);
  process.exit(2);
});
