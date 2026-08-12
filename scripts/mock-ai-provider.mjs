// Minimal OpenAI-compatible mock provider for runtime verification of the
// AI provider migration. Implements /v1/chat/completions and /v1/models.
// Returns deterministic JSON or text depending on the prompt. Not committed
// to the app; a throwaway test helper.
import { createServer } from "http";

const PORT = process.env.MOCK_AI_PORT || 8787;

const server = createServer((req, res) => {
  // CORS / preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = req.url || "";

    if (url.startsWith("/v1/models")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          object: "list",
          data: [{ id: "mock-model", object: "model" }],
        })
      );
      return;
    }

    if (url.startsWith("/v1/chat/completions")) {
      let parsed = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        parsed = {};
      }
      const messages = parsed.messages || [];
      const system = (messages.find((m) => m.role === "system")?.content || "").toLowerCase();
      const user = (messages.find((m) => m.role === "user")?.content || "").toLowerCase();
      const jsonMode = parsed.response_format?.type === "json_object";

      let content;
      if (system.includes("translator")) {
        // translation: parse the user payload and echo the SAME structure back
        // with a [TR] prefix so the DB upsert succeeds (field names match).
        let translated = {};
        const jsonStart = user.indexOf("{");
        const jsonEnd = user.lastIndexOf("}");
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          try {
            translated = JSON.parse(user.slice(jsonStart, jsonEnd + 1));
          } catch {
            translated = {};
          }
        }
        if (translated.questionText !== undefined) {
          // question translation
          content = JSON.stringify({
            questionText: "[TR] " + (translated.questionText || ""),
            hint: translated.hint ?? null,
            hostNotes: translated.hostNotes ?? null,
            easterEggButtonText: translated.easterEggButtonText ?? null,
            answers: (translated.answers || []).map((a) => ({
              id: a.id,
              answerText: "[TR] " + a.answerText,
            })),
          });
        } else if (translated.title !== undefined) {
          // section translation
          content = JSON.stringify({
            title: "[TR] " + (translated.title || ""),
            description: translated.description ?? null,
          });
        } else {
          content = JSON.stringify({
            questionText: "[TR] question",
            hint: null,
            hostNotes: null,
            easterEggButtonText: null,
            answers: [{ id: "a1", answerText: "[TR] answer" }],
          });
        }
      } else if (system.includes("json themes") || user.includes("theme")) {
        content = JSON.stringify({
          name: "Mock Theme",
          colors: {
            primary: "#6366f1",
            secondary: "#8b5cf6",
            background: "#0f172a",
            surface: "#1e293b",
            text: "#f8fafc",
            muted: "#94a3b8",
            success: "#22c55e",
            warning: "#f59e0b",
            danger: "#ef4444",
          },
          gradients: {
            pageBackground: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          },
          fonts: { heading: "Inter", body: "Inter" },
        });
      } else if (system.includes("quiz master") || user.includes("trivia quiz")) {
        content = JSON.stringify({
          title: "Mock Quiz",
          description: "Mock generated quiz",
          sections: [
            {
              title: "Section 1",
              description: "desc",
              imageUrl: null,
              questions: [
                {
                  questionText: "Mock question?",
                  questionType: "SINGLE_SELECT",
                  hint: "hint",
                  hostNotes: "notes",
                  imageUrl: null,
                  timeLimit: 30,
                  points: 100,
                  answers: [
                    { answerText: "Correct", isCorrect: true },
                    { answerText: "Wrong", isCorrect: false },
                  ],
                },
              ],
            },
          ],
          questions: [],
        });
      } else if (system.includes("announcer") || user.includes("congratulatory")) {
        content = "Great job on the quiz, champion!";
      } else {
        content = jsonMode
          ? JSON.stringify({ result: "ok" })
          : "Mock AI response";
      }

      const out = {
        id: "chatcmpl-mock",
        object: "chat.completion",
        choices: [
          { index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });
});

server.listen(PORT, () => {
  console.log(`Mock AI provider listening on http://localhost:${PORT}`);
});
