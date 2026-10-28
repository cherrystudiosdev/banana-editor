import { EditPlanSchema, type EditPlan, type EditStep, type Transcript } from '../../shared/ai';
import { newId, type Project } from '../../shared/model';
import { executeCommands, findClip, type Command } from '../../core/commands';
import { validateProject } from '../../core/validation';
import { AIError } from './errors';

function inScope(project: Project, selectedClipIds: string[], start: number, end = start + 1): boolean {
  return selectedClipIds.some(id => {
    const { clip } = findClip(project, id);
    return start >= clip.start && end <= clip.start + clip.duration;
  });
}

export function planCommands(project: Project, plan: EditPlan): Command[] {
  return plan.steps.map((step): Command => {
    if (step.type === 'addMarker') return { type: 'addMarker', marker: { id: newId(), frame: step.frame, name: step.name, color: '#f4dc54' } };
    if (step.type === 'setCaptionText') {
      const { clip } = findClip(project, step.clipId);
      if (clip.kind !== 'caption' || !clip.text) throw new AIError('invalid_output', 'Caption correction can only edit caption text.');
      return { type: 'updateClip', clipId: step.clipId, patch: { text: { ...clip.text, text: step.text } } };
    }
    return step;
  });
}

export function validateEditPlan(project: Project, value: unknown, selectedClipIds: string[]): EditPlan {
  const parsed = EditPlanSchema.safeParse(value);
  if (!parsed.success) throw new AIError('invalid_output', 'The edit plan contains an invalid or unauthorized operation.');
  const plan = parsed.data;
  if (plan.projectId !== project.id || plan.sequenceId !== project.sequence.id) throw new AIError('invalid_output', 'The plan belongs to a different project or sequence.');
  if (plan.baseRevision !== project.revision) throw new AIError('invalid_output', 'The project changed after this plan was created. Request a new plan.');
  if (project.appliedPlanIds.includes(plan.id)) throw new AIError('invalid_output', 'This plan has already been applied.');
  const selected = new Set(selectedClipIds);
  if (!selected.size) throw new AIError('invalid_input', 'Select the clips this plan is allowed to edit.');
  for (const id of selected) findClip(project, id);
  for (const step of plan.steps) {
    if ('clipId' in step) {
      if (!selected.has(step.clipId)) throw new AIError('invalid_output', 'The plan tries to edit a clip outside the approved selection.');
      const { clip, track } = findClip(project, step.clipId);
      if (track.locked) throw new AIError('invalid_output', 'The plan tries to edit a locked track.');
      if (['splitClip', 'trimClip'].includes(step.type)) {
        for (const group of project.linkedGroups.filter(group => group.clipIds.includes(step.clipId))) {
          if (group.clipIds.some(id => !selected.has(id))) throw new AIError('invalid_output', 'Select the linked clips too before applying this timing change.');
        }
      }
      if (step.type === 'trimClip' && (step.start < clip.start || step.start + step.duration > clip.start + clip.duration || step.sourceIn < clip.sourceIn || step.sourceIn + step.duration * project.sequence.fps.den / project.sequence.fps.num > clip.sourceIn + clip.duration * project.sequence.fps.den / project.sequence.fps.num + 1e-9)) throw new AIError('invalid_output', 'The trim extends outside the approved source or timeline range.');
    } else if (step.type === 'addMarker') {
      if (!inScope(project, selectedClipIds, step.frame)) throw new AIError('invalid_output', 'The marker falls outside the approved selection.');
    } else {
      const track = project.sequence.tracks.find(track => track.id === step.trackId);
      if (!track || track.kind !== 'video' || track.locked) throw new AIError('invalid_output', 'The text target must be an unlocked video track.');
      if (!inScope(project, selectedClipIds, step.start, step.start + step.duration)) throw new AIError('invalid_output', 'The text layer extends outside the approved selection.');
    }
  }
  // Validate every command on a copy before the user can apply any part of the plan.
  try { executeCommands(project, planCommands(project, plan)); }
  catch { throw new AIError('invalid_output', 'The plan violates timeline bounds, track locks, source handles, or overlap rules. Nothing was changed.'); }
  return plan;
}

/** Caller places the returned project into one history transaction. */
export function applyEditPlan(project: Project, value: unknown, selectedClipIds: string[]): Project {
  const plan = validateEditPlan(project, value, selectedClipIds);
  const next = executeCommands(project, planCommands(project, plan));
  next.appliedPlanIds.push(plan.id);
  return validateProject(next);
}

export function transcriptToCaptionPlan(project: Project, transcript: Transcript, selectedClipIds: string[]): EditPlan | undefined {
  if (!transcript.segments.length) return undefined;
  const fps = project.sequence.fps.num / project.sequence.fps.den;
  const steps: EditStep[] = [];
  for (const segment of transcript.segments) {
    const { clip } = findClip(project, segment.clipId);
    const start = Math.max(clip.start, clip.start + Math.round((segment.start - clip.sourceIn) * fps));
    const end = Math.min(clip.start + clip.duration, clip.start + Math.round((segment.end - clip.sourceIn) * fps));
    if (end <= start || !segment.text.trim()) continue;
    const track = project.sequence.tracks.find(track => track.kind === 'video' && !track.locked && track.clips.every(other => other.start + other.duration <= start || other.start >= end) && steps.every(other => !('trackId' in other) || other.trackId !== track.id || other.start + other.duration <= start || other.start >= end));
    if (!track) return undefined;
    steps.push({ type: 'addCaption', trackId: track.id, start, duration: end - start, text: segment.text });
  }
  if (!steps.length) return undefined;
  return validateEditPlan(project, { schemaVersion: 1, id: newId(), projectId: project.id, sequenceId: project.sequence.id, baseRevision: project.revision, description: 'Add reviewed transcript captions. Segment timing requires review.', steps }, selectedClipIds);
}
