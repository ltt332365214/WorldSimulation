import { DialogueData, DialogueLine, DialogueChoice } from '../types';

export class Dialogue {
  private data: DialogueData;
  private currentLineIndex: number;

  constructor(data: DialogueData) {
    this.data = { ...data };
    this.currentLineIndex = 0;
  }

  get id(): string { return this.data.id; }
  get participants(): string[] { return [...this.data.participants]; }

  getData(): DialogueData {
    return { ...this.data };
  }

  getCurrentLine(): DialogueLine | null {
    if (this.currentLineIndex < 0 || this.currentLineIndex >= this.data.lines.length) return null;
    return this.data.lines[this.currentLineIndex];
  }

  getChoices(): DialogueChoice[] {
    const line = this.getCurrentLine();
    return line?.choices ?? [];
  }

  selectChoice(choice: DialogueChoice): DialogueLine | null {
    if (choice.nextLineIndex !== undefined && choice.nextLineIndex >= 0 && choice.nextLineIndex < this.data.lines.length) {
      this.currentLineIndex = choice.nextLineIndex;
    } else {
      this.currentLineIndex++;
    }
    return this.getCurrentLine();
  }

  advance(): DialogueLine | null {
    this.currentLineIndex++;
    return this.getCurrentLine();
  }

  isFinished(): boolean {
    return this.currentLineIndex >= this.data.lines.length;
  }

  serialize(): { data: DialogueData; currentLineIndex: number } {
    return { data: { ...this.data, lines: [...this.data.lines], participants: [...this.data.participants] }, currentLineIndex: this.currentLineIndex };
  }

  static deserialize(serialized: { data: DialogueData; currentLineIndex: number }): Dialogue {
    const dialogue = new Dialogue(serialized.data);
    dialogue.currentLineIndex = serialized.currentLineIndex;
    return dialogue;
  }
}