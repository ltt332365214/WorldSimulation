'use client';

import { DialogueData, DialogueLine, DialogueChoice, WorldState } from '@/engine/types';

export default function DialoguePanel({
  dialogue, currentLine, choices, snapshot,
  onChoice, onAdvance,
}: {
  dialogue: DialogueData;
  currentLine: DialogueLine | null;
  choices: DialogueChoice[];
  snapshot: WorldState;
  onChoice: (choiceIndex: number) => void;
  onAdvance: () => void;
}) {
  if (!currentLine) return null;

  const speakerName = snapshot.agents[currentLine.speaker]?.name ?? currentLine.speaker;

  return (
    <div className="rounded-lg border border-vermillion/40 bg-ink p-5">
      <h3 className="text-sm font-bold text-vermillion-light mb-3">对话</h3>

      <div className="mb-4">
        <span className="text-xs text-amber-200/40 block mb-1">
          {speakerName}
        </span>
        <p className="scene-text text-amber-100 text-base leading-relaxed">
          {currentLine.text}
        </p>
        {currentLine.emotionTag && (
          <span className="text-xs text-vermillion/60 mt-1 block">[{currentLine.emotionTag}]</span>
        )}
      </div>

      {choices.length > 0 ? (
        <div className="space-y-2">
          {choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => onChoice(idx)}
              className="dialogue-choice block w-full text-left px-4 py-2 rounded text-sm text-amber-200/80"
            >
              {choice.text}
              {choice.emotionTag && (
                <span className="text-xs text-vermillion/60 ml-2">[{choice.emotionTag}]</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={onAdvance}
          className="action-btn px-4 py-2 rounded text-sm text-amber-200/80"
        >
          继续
        </button>
      )}
    </div>
  );
}