import type { Project } from '../shared/model';
import { executeCommands, type Command } from './commands';
import { validateProject } from './validation';

export class History {
  private past: Project[] = [];
  private future: Project[] = [];
  current: Project;
  constructor(project: Project, private readonly limit = 100) { this.current = validateProject(project); }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  execute(commands: readonly Command[]): Project {
    if (!commands.length) return this.current;
    const next = executeCommands(this.current, commands);
    this.past.push(this.current); if (this.past.length > this.limit) this.past.shift();
    this.future = []; this.current = next; return next;
  }
  commit(project: Project): Project {
    const next = validateProject(project);
    if (next.id !== this.current.id || next.revision !== this.current.revision + 1) throw new Error('Transaction belongs to a stale or different project');
    this.past.push(this.current); if (this.past.length > this.limit) this.past.shift();
    this.future = []; this.current = next; return next;
  }
  undo(): Project {
    const previous = this.past.pop(); if (!previous) return this.current;
    this.future.push(this.current); this.current = { ...previous, revision: this.current.revision + 1 }; return this.current;
  }
  redo(): Project {
    const next = this.future.pop(); if (!next) return this.current;
    this.past.push(this.current); this.current = { ...next, revision: this.current.revision + 1 }; return this.current;
  }
  reset(project: Project): Project { this.current = validateProject(project); this.past = []; this.future = []; return this.current; }
}
