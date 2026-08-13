"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayerViewState } from "@/types";
import {
  AlarmClock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Maximize2,
  Monitor,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const ITEMS_PER_PAGE = 9;

export default function PlayerMonitorPage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = use(params);
  const { t } = useTranslation();
  const { connected, playerViews, requestPlayerViews } = useSocket({
    gameCode,
    role: "host",
  });
  const [expanded, setExpanded] = useState<PlayerViewState | null>(null);

  const viewsArray = useMemo(() => {
    return Array.from(playerViews.values()).sort((a, b) =>
      a.playerName.localeCompare(b.playerName)
    );
  }, [playerViews]);

  useEffect(() => {
    if (connected) {
      requestPlayerViews();
    }
  }, [connected, requestPlayerViews]);

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t("host.connectingToMonitor")}</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card/60 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("host.gameCodeLabel", { code: gameCode.toUpperCase() })}</p>
              <h1 className="text-xl font-semibold">{t("host.playerMonitor")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="w-4 h-4" />
              {viewsArray.length} players
            </Badge>
            <Button variant="outline" size="sm" onClick={requestPlayerViews} className="gap-2">
              <Monitor className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {viewsArray.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/70 p-10 text-center text-muted-foreground">
            Waiting for players to join... keep this window open to see live previews.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {viewsArray.map((view) => (
                <PlayerPreview
                  key={view.playerId}
                  view={view}
                  onExpand={() => setExpanded(view)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl">
            <div className="absolute -top-10 right-0 flex items-center gap-2 text-sm text-white/80">
              <Badge variant="secondary" className="bg-white/90 text-black">
                {stageLabel(expanded.stage, t)}
              </Badge>
              <Button variant="secondary" size="sm" onClick={() => setExpanded(null)} className="gap-2">
                <X className="w-4 h-4" />
                {t("common.close")}
              </Button>
            </div>
            <div className="relative aspect-[16/9] bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
              {expanded.screenshot ? (
                <img
                  src={expanded.screenshot}
                  alt={`${expanded.playerName} monitor`}
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/70">
                  {emptyMessageForStage(expanded.stage, t)}
                </div>
              )}
              <div className="absolute left-4 bottom-4 bg-black/55 backdrop-blur px-3 py-2 rounded-lg text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">{t("host.player")}</p>
                <p className="text-lg font-semibold">{expanded.playerName}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PlayerPreview({ view, onExpand }: { view: PlayerViewState; onExpand: () => void }) {
  const { t } = useTranslation();
  const stage = view.stage;

  return (
    <Card
      className="overflow-hidden border border-border/70 shadow-lg cursor-pointer transition hover:border-primary/80"
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      }}
    >
      <div className="relative aspect-[16/9] bg-card">
        {view.screenshot ? (
          <img
            src={view.screenshot}
            alt={`${view.playerName} screen`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            {emptyMessageForStage(stage, t)}
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 p-3 flex items-center justify-between bg-gradient-to-t from-black/60 via-black/20 to-transparent">
          <div className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-lg">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{t("host.player")}</p>
            <p className="text-sm font-semibold text-white">{view.playerName}</p>
          </div>
          <div className="flex items-center gap-2">
            {view.downloadStatus && (
              <div className="flex items-center gap-2 text-[11px] text-white/80">
                <span>{Math.round(view.downloadStatus.percentage)}%</span>
                <Progress className="w-20 h-1" value={view.downloadStatus.percentage} />
              </div>
            )}
            <Badge variant="secondary" className="uppercase tracking-wide text-[11px] bg-white/90 text-black">
              {stageLabel(stage, t)}
            </Badge>
            <div className="rounded-full bg-black/50 p-2 text-white">
              <Maximize2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/40">
        <span>{t("host.status")} {view.isActive === false ? t("host.inactive") : t("host.active")}</span>
        {view.answerResult && (
          <span className="inline-flex items-center gap-1">
            {view.answerResult.correct ? t("host.answered") : t("host.missed")}
            <span className="font-semibold text-foreground">
              +{view.answerResult.points} {t("host.pts")}
            </span>
          </span>
        )}
      </div>
    </Card>
  );
}

function stageLabel(stage: PlayerViewState["stage"], t: (k: string) => string) {
  switch (stage) {
    case "waiting":
      return t("host.stageLobby");
    case "section":
      return t("host.stageSection");
    case "question":
      return t("host.stageQuestion");
    case "awaiting-reveal":
      return t("host.stageAwaitingReveal");
    case "reveal":
      return t("host.stageReveal");
    case "scoreboard":
      return t("host.stageScoreboard");
    case "finished":
      return t("host.stageFinished");
    case "cancelled":
      return t("host.stageCancelled");
    case "removed":
      return t("host.stageRemoved");
    default:
      return t("host.stageConnecting");
  }
}

function emptyMessageForStage(stage: PlayerViewState["stage"], t: (k: string) => string) {
  switch (stage) {
    case "waiting":
      return t("host.emptyLobby");
    case "section":
      return t("host.emptySection");
    case "awaiting-reveal":
      return t("host.emptyAwaitingReveal");
    case "reveal":
      return t("host.emptyReveal");
    case "scoreboard":
      return t("host.emptyScoreboard");
    case "finished":
      return t("host.emptyFinished");
    case "cancelled":
      return t("host.emptyCancelled");
    case "removed":
      return t("host.emptyRemoved");
    default:
      return t("host.emptyWaiting");
  }
}
