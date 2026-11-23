import React from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { TypeOneWord } from './TypeOneWord.tsx';
import { Reconstruct } from './Reconstruct.tsx';
import { ReadAndChoose } from './ReadAndChoose.tsx';
import { WriteEmail } from './WriteEmail.tsx';
import { Dictation } from './Dictation.tsx';
import { ChooseResponse } from './ChooseResponse.tsx';
import { ListenAndSpeak } from './ListenAndSpeak.tsx';
import { RepeatSentence } from './RepeatSentence.tsx';
import { SpeakingSituation } from './SpeakingSituation.tsx';
import { StoryRetell } from './StoryRetell.tsx';

interface TaskCardProps {
  sessionId: string;
  item: PublicItem;
  onTextSubmit: (data: {
    itemId: string;
    sub?: number | null;
    text?: string;
    choice?: number;
    choices?: number[];
    integrity?: { pasted: boolean; pasteChars: number };
  }) => void;
  onAudioSubmit: (data: {
    itemId: string;
    sub?: number | null;
    blob: Blob;
    durationMs: number;
  }) => void;
  disabled?: boolean;
}

export function TaskCard({
  sessionId,
  item,
  onTextSubmit,
  onAudioSubmit,
  disabled,
}: TaskCardProps) {
  switch (item.part) {
    case 'A':
      return (
        <TypeOneWord
          item={item}
          onSubmit={(text) => onTextSubmit({ itemId: item.id, text })}
          disabled={disabled}
        />
      );

    case 'B':
      return (
        <Reconstruct
          item={item}
          onSubmit={(text, integrity) => onTextSubmit({ itemId: item.id, text, integrity })}
          disabled={disabled}
        />
      );

    case 'C':
      return (
        <ReadAndChoose
          item={item}
          onSubmit={(choices) => onTextSubmit({ itemId: item.id, choices })}
          disabled={disabled}
        />
      );

    case 'D':
      return (
        <WriteEmail
          item={item}
          onSubmit={(text, integrity) => onTextSubmit({ itemId: item.id, text, integrity })}
          disabled={disabled}
        />
      );

    case 'E':
      return (
        <Dictation
          sessionId={sessionId}
          item={item}
          onSubmit={(text) => onTextSubmit({ itemId: item.id, text })}
          disabled={disabled}
        />
      );

    case 'F':
      return (
        <ChooseResponse
          sessionId={sessionId}
          item={item}
          onSubmit={(choice) => onTextSubmit({ itemId: item.id, choice })}
          disabled={disabled}
        />
      );

    case 'G':
      return (
        <ListenAndSpeak
          sessionId={sessionId}
          item={item}
          onSubmit={(blob, durationMs, subIndex) =>
            onAudioSubmit({ itemId: item.id, sub: subIndex, blob, durationMs })
          }
          disabled={disabled}
        />
      );

    case 'H':
      return (
        <RepeatSentence
          sessionId={sessionId}
          item={item}
          onSubmit={(blob, durationMs) => onAudioSubmit({ itemId: item.id, blob, durationMs })}
          disabled={disabled}
        />
      );

    case 'I':
      return (
        <SpeakingSituation
          item={item}
          onSubmit={(blob, durationMs) => onAudioSubmit({ itemId: item.id, blob, durationMs })}
          disabled={disabled}
        />
      );

    case 'J':
      return (
        <StoryRetell
          sessionId={sessionId}
          item={item}
          onSubmit={(blob, durationMs) => onAudioSubmit({ itemId: item.id, blob, durationMs })}
          disabled={disabled}
        />
      );

    default:
      return null;
  }
}
