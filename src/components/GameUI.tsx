'use client';

import { SceneDescription, Action, LogEntry, WorldState, DialogueData, DialogueLine, DialogueChoice } from '@/engine/types';
import SceneView from './SceneView';
import NearbyPanel from './NearbyPanel';
import ActionMenu from './ActionMenu';
import StatusPanel from './StatusPanel';
import LogStream from './LogStream';
import DialoguePanel from './DialoguePanel';
import SaveLoadPanel from './SaveLoadPanel';

interface GameUIProps {
  scene: SceneDescription;
  actions: Action[];
  log: LogEntry[];
  snapshot: WorldState;
  activeDialogue: DialogueData | null;
  currentDialogueLine: DialogueLine | null;
  dialogueChoices: DialogueChoice[];
  onAction: (action: Action) => void;
  onDialogueChoice: (choiceIndex: number) => void;
  onDialogueAdvance: () => void;
  onExportSave: () => void;
  onImportSave: (file: File) => Promise<void>;
  onSaveLocal: () => void;
  onTick: () => void;
}

export default function GameUI({
  scene, actions, log, snapshot,
  activeDialogue, currentDialogueLine, dialogueChoices,
  onAction, onDialogueChoice, onDialogueAdvance,
  onExportSave, onImportSave, onSaveLocal, onTick,
}: GameUIProps) {
  const player = snapshot.agents[snapshot.playerAgentId];
  const clock = snapshot.clock;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-bronze/30 bg-ink/80">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-amber-100">
            {player?.name ?? '旅人'} · {scene.locationName}
          </h1>
          <span className="text-sm text-amber-200/50">
            {clock.year}年{clock.month}月{clock.day}日 · {clock.hour}时{clock.minute !== 0 ? `${clock.minute}分` : ''}
          </span>
          <span className="text-sm text-jade-light">{scene.timeOfDay}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onTick}
            className="text-sm px-3 py-1 rounded border border-bronze/40 text-amber-200/70 hover:border-bronze-light hover:text-amber-100 transition-all"
          >
            推进时间
          </button>
          <button
            onClick={onSaveLocal}
            className="text-sm px-3 py-1 rounded border border-jade/40 text-jade-light/70 hover:border-jade-light hover:text-jade-light transition-all"
          >
            保存
          </button>
          <SaveLoadPanel onExport={onExportSave} onImport={onImportSave} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* Left: Game content */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
          <SceneView scene={scene} />
          <NearbyPanel
            agents={scene.nearbyAgents}
            items={scene.nearbyItems}
            exits={scene.availableExits}
            locations={snapshot.locations}
          />
          {activeDialogue && currentDialogueLine ? (
            <DialoguePanel
              dialogue={activeDialogue}
              currentLine={currentDialogueLine}
              choices={dialogueChoices}
              snapshot={snapshot}
              onChoice={onDialogueChoice}
              onAdvance={onDialogueAdvance}
            />
          ) : (
            <ActionMenu
              actions={actions}
              onAction={onAction}
              snapshot={snapshot}
            />
          )}
        </div>

        {/* Right sidebar: Status + Log */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-bronze/20 flex flex-col bg-ink-light/30">
          <div className="p-4 border-b border-bronze/20">
            <StatusPanel player={player} />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <LogStream log={log} />
          </div>
        </div>
      </div>
    </div>
  );
}