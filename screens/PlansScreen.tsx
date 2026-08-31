import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import PlanCard from '../components/PlanCard';
import SessionRecalibrationModal from '../components/SessionRecalibrationModal';
import ThemeEmojiPicker from '../components/ThemeEmojiPicker';
import { useAiGate } from '../hooks/useAiGate';
import type { CoachPersonality } from '../lib/claude';
import { fetchCoachPersonality } from '../lib/coachInsights';
import { fetchExercises } from '../lib/exercises';
import {
  addPlanToProgram,
  applyStarterTemplate,
  assignWeekday,
  computeFlexibleProgress,
  computeWeekdayProgress,
  countCompletedSessionsForProgram,
  createPlan,
  createProgram,
  fetchAllProgramPlans,
  fetchPlans,
  fetchPrograms,
  fetchSchedule,
  fetchWorkoutLogsInRange,
  PLAN_THEMES,
  STARTER_TEMPLATES,
  type StarterTemplate,
} from '../lib/plans';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type {
  Exercise,
  PlanScheduleEntry,
  PlanThemeKey,
  Program,
  ProgramPlanEntry,
  WorkoutPlan,
} from '../lib/types';
import PlanDetailScreen from './PlanDetailScreen';
import ProgramDetailScreen from './ProgramDetailScreen';

type PlansView =
  | { mode: 'list' }
  | { mode: 'newPlan' }
  | { mode: 'newProgram' }
  | { mode: 'planDetail'; planId: string; sessionMode?: boolean; programId?: string | null }
  | { mode: 'programDetail'; programId: string };

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS: Record<number, string> = {
  0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
};

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PlansScreen({ session }: { session: Session }) {
  const [view, setView] = useState<PlansView>({ mode: 'list' });
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [schedule, setSchedule] = useState<PlanScheduleEntry[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programPlans, setProgramPlans] = useState<ProgramPlanEntry[]>([]);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [completedByProgram, setCompletedByProgram] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTheme, setNewTheme] = useState<PlanThemeKey>('neon');
  const [newEmoji, setNewEmoji] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pickerWeekday, setPickerWeekday] = useState<number | null>(null);

  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramMode, setNewProgramMode] = useState<'weekday' | 'flexible'>('flexible');
  const [creatingProgram, setCreatingProgram] = useState(false);

  const [recalibrateOpen, setRecalibrateOpen] = useState(false);
  const [personality, setPersonality] = useState<CoachPersonality>('encouraging');
  const aiGate = useAiGate();

  const [allExercises, setAllExercises] = useState<Exercise[] | null>(null);
  const [applyingTemplateKey, setApplyingTemplateKey] = useState<string | null>(null);
  const [templateResult, setTemplateResult] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const weekStart = startOfWeek(new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const [plansData, scheduleData, programsData, programPlansData, logs] = await Promise.all([
        fetchPlans(),
        fetchSchedule(),
        fetchPrograms(),
        fetchAllProgramPlans(),
        fetchWorkoutLogsInRange(toDateStr(weekStart), toDateStr(weekEnd)),
      ]);
      setPlans(plansData);
      setSchedule(scheduleData);
      setPrograms(programsData);
      setProgramPlans(programPlansData);
      setLoggedDates(new Set(logs.map((l) => l.logged_date)));

      const flexiblePrograms = programsData.filter((p) => p.schedule_mode === 'flexible');
      const counts = await Promise.all(flexiblePrograms.map((p) => countCompletedSessionsForProgram(p.id)));
      setCompletedByProgram(new Map(flexiblePrograms.map((p, i) => [p.id, counts[i]])));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (view.mode !== 'list') return;
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [view.mode, fetchAll]);

  useEffect(() => {
    fetchCoachPersonality().then(setPersonality).catch(() => {});
  }, []);

  const createNewPlan = async () => {
    if (!newName.trim()) {
      setError('Please give your plan a name.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const plan = await createPlan({ name: newName.trim(), description: newDescription.trim(), themeKey: newTheme, emoji: newEmoji });
      setNewName('');
      setNewDescription('');
      setNewTheme('neon');
      setNewEmoji(null);
      setView({ mode: 'planDetail', planId: plan.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const createNewProgram = async () => {
    if (!newProgramName.trim()) {
      setError('Please give your program a name.');
      return;
    }
    setCreatingProgram(true);
    setError(null);
    try {
      const program = await createProgram({ name: newProgramName.trim(), scheduleMode: newProgramMode });
      setNewProgramName('');
      setView({ mode: 'programDetail', programId: program.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingProgram(false);
    }
  };

  const assignDay = async (weekday: number, planId: string | null) => {
    setPickerWeekday(null);
    try {
      await assignWeekday(weekday, planId);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const applyTemplate = async (template: StarterTemplate) => {
    setApplyingTemplateKey(template.key);
    setTemplateResult(null);
    setError(null);
    try {
      let exercises = allExercises;
      if (!exercises) {
        exercises = await fetchExercises();
        setAllExercises(exercises);
      }
      const outcome = await applyStarterTemplate(template, exercises);
      setTemplateResult(
        outcome.missing.length > 0
          ? `Added "${template.title}" (a few exercises weren't found in your catalog and were skipped).`
          : `Added "${template.title}" to My Plans.`
      );
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyingTemplateKey(null);
    }
  };

  // ── Resolve which program/plan "today" actually points to, from real
  // schedule data only -- never fabricated. Priority: a weekday-mode
  // program scheduled for today > the next session of a flexible-mode
  // program > the legacy per-weekday plan_schedule (pre-programs users).
  const resolved = useMemo(() => {
    const todayWeekday = new Date().getDay();
    const plansById = new Map(plans.map((p) => [p.id, p]));
    const entriesByProgram = new Map<string, ProgramPlanEntry[]>();
    for (const e of programPlans) {
      const arr = entriesByProgram.get(e.program_id) ?? [];
      arr.push(e);
      entriesByProgram.set(e.program_id, arr);
    }

    for (const p of programs) {
      if (p.schedule_mode !== 'weekday') continue;
      const entries = entriesByProgram.get(p.id) ?? [];
      const match = entries.find((e) => e.weekday === todayWeekday);
      if (match) {
        return {
          kind: 'weekday' as const,
          program: p,
          plan: plansById.get(match.plan_id) ?? null,
          entries,
        };
      }
    }

    const flexiblePrograms = programs.filter((p) => p.schedule_mode === 'flexible' && (entriesByProgram.get(p.id)?.length ?? 0) > 0);
    if (flexiblePrograms.length > 0) {
      const p = flexiblePrograms[0];
      const entries = entriesByProgram.get(p.id) ?? [];
      const progress = computeFlexibleProgress(entries, completedByProgram.get(p.id) ?? 0);
      return {
        kind: 'flexible' as const,
        program: p,
        plan: progress.nextEntry ? plansById.get(progress.nextEntry.plan_id) ?? null : null,
        entries,
        progress,
      };
    }

    const legacyEntry = schedule.find((s) => s.weekday === todayWeekday && s.plan_id);
    if (legacyEntry) {
      return { kind: 'legacy' as const, program: null, plan: plansById.get(legacyEntry.plan_id as string) ?? null, entries: [] };
    }

    return { kind: 'none' as const, program: null, plan: null, entries: [] };
  }, [plans, programs, programPlans, schedule, completedByProgram]);

  const standalonePlans = useMemo(() => {
    const grouped = new Set(programPlans.map((e) => e.plan_id));
    return plans.filter((p) => !grouped.has(p.id));
  }, [plans, programPlans]);

  if (view.mode === 'planDetail') {
    return (
      <PlanDetailScreen
        planId={view.planId}
        sessionMode={view.sessionMode}
        programId={view.programId}
        onBack={() => setView({ mode: 'list' })}
        onDeleted={() => setView({ mode: 'list' })}
        onSessionFinished={() => {}}
      />
    );
  }

  if (view.mode === 'programDetail') {
    return (
      <ProgramDetailScreen
        programId={view.programId}
        onBack={() => setView({ mode: 'list' })}
        onDeleted={() => setView({ mode: 'list' })}
        onOpenPlan={(planId) => setView({ mode: 'planDetail', planId })}
        onStartSession={(planId, programId) => setView({ mode: 'planDetail', planId, sessionMode: true, programId })}
      />
    );
  }

  if (view.mode === 'newPlan') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContent}>
        <Pressable onPress={() => setView({ mode: 'list' })}>
          <Text style={styles.back}>{'< My Plans'}</Text>
        </Pressable>
        <Text style={styles.title}>New Plan</Text>

        <TextInput
          style={styles.input}
          placeholder="Plan name (e.g. Push Day)"
          placeholderTextColor={dark.textFaint}
          value={newName}
          onChangeText={setNewName}
        />
        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          placeholderTextColor={dark.textFaint}
          value={newDescription}
          onChangeText={setNewDescription}
        />

        <ThemeEmojiPicker themeKey={newTheme} emoji={newEmoji} onChangeTheme={setNewTheme} onChangeEmoji={setNewEmoji} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.createButton} onPress={createNewPlan} disabled={creating}>
          {creating ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.createButtonText}>Create Plan</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  if (view.mode === 'newProgram') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.formContent}>
        <Pressable onPress={() => setView({ mode: 'list' })}>
          <Text style={styles.back}>{'< My Plans'}</Text>
        </Pressable>
        <Text style={styles.title}>New Program</Text>
        <Text style={styles.hint}>A program groups multiple plans into a rotation. You'll add plans to it next.</Text>

        <TextInput
          style={styles.input}
          placeholder="Program name (e.g. 4-Day Push/Pull/Legs)"
          placeholderTextColor={dark.textFaint}
          value={newProgramName}
          onChangeText={setNewProgramName}
        />

        <Text style={styles.label}>Schedule mode</Text>
        <View style={styles.row}>
          {(['flexible', 'weekday'] as const).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.modeChip, newProgramMode === mode && styles.modeChipActive]}
              onPress={() => setNewProgramMode(mode)}
            >
              <Text style={[styles.modeChipText, newProgramMode === mode && styles.modeChipTextActive]}>
                {mode === 'weekday' ? 'Fixed Weekdays' : 'Flexible (Session 1, 2, 3...)'}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.createButton} onPress={createNewProgram} disabled={creatingProgram}>
          {creatingProgram ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.createButtonText}>Create Program</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  const heroTheme = resolved.program ? PLAN_THEMES[resolved.program.theme_key] : PLAN_THEMES[resolved.plan?.theme_key ?? 'neon'];
  const weekdayProgress =
    resolved.kind === 'weekday' && resolved.program ? computeWeekdayProgress(resolved.program, resolved.entries, loggedDates) : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Plans</Text>
          <View style={styles.headerButtons}>
            <Pressable onPress={() => setView({ mode: 'newProgram' })}>
              <Text style={styles.newPlan}>+ Program</Text>
            </Pressable>
            <Pressable onPress={() => setView({ mode: 'newPlan' })}>
              <Text style={styles.newPlan}>+ Plan</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Zone 1: Hero ── */}
        <View style={[styles.heroCard, { borderColor: heroTheme.accent, backgroundColor: heroTheme.surface }]}>
          <Text style={styles.heroLabel}>{resolved.kind === 'none' ? 'GET STARTED' : "TODAY'S SESSION"}</Text>
          <Text style={styles.heroEmoji}>{resolved.plan?.emoji ?? resolved.program?.emoji ?? '💪'}</Text>
          <Text style={styles.heroTitle}>{resolved.plan?.name ?? (resolved.kind === 'none' ? 'No plan scheduled' : 'Rest day')}</Text>

          {resolved.kind === 'weekday' && weekdayProgress && (
            <Text style={[styles.heroProgress, { color: heroTheme.accent }]}>
              {weekdayProgress.weekNumber
                ? `WEEK ${weekdayProgress.weekNumber}${weekdayProgress.totalWeeks ? ` OF ${weekdayProgress.totalWeeks}` : ''}${weekdayProgress.isDeloadWeek ? ' • DELOAD WEEK' : ''}`
                : resolved.program?.name}
            </Text>
          )}
          {resolved.kind === 'flexible' && resolved.progress && (
            <Text style={[styles.heroProgress, { color: heroTheme.accent }]}>
              {resolved.program?.name} • SESSION {(resolved.progress.completedSessions % Math.max(1, resolved.progress.totalSessions)) + 1} OF{' '}
              {resolved.progress.totalSessions}
            </Text>
          )}

          {resolved.plan ? (
            <Pressable
              style={styles.heroButton}
              onPress={() =>
                setView({ mode: 'planDetail', planId: resolved.plan!.id, sessionMode: true, programId: resolved.program?.id ?? null })
              }
            >
              <Text style={styles.heroButtonText}>▶ Start Workout</Text>
            </Pressable>
          ) : (
            <Text style={styles.heroSubtitle}>
              {plans.length > 0 ? 'Nothing scheduled for today — pick a plan below.' : 'Create a plan or use a starter template below.'}
            </Text>
          )}
        </View>

        {/* Weekly schedule strip */}
        {resolved.kind === 'weekday' && resolved.program && (
          <>
            <Text style={styles.sectionTitle}>This Week — {resolved.program.name}</Text>
            {WEEKDAY_ORDER.map((wd) => {
              const entry = resolved.entries.find((e) => e.weekday === wd);
              const plan = entry ? plans.find((p) => p.id === entry.plan_id) : null;
              const isToday = wd === new Date().getDay();
              const done = plan ? loggedDates.has(toDateStr(weekdayDate(wd))) : false;
              return (
                <View key={wd} style={[styles.scheduleRow, isToday && styles.scheduleRowToday]}>
                  <Text style={styles.scheduleDay}>{WEEKDAY_LABELS[wd]}</Text>
                  <Text style={styles.schedulePlan}>{plan ? plan.name : 'Rest'}</Text>
                  {plan && (done ? <Text style={styles.scheduleDone}>✓</Text> : isToday ? <Text style={styles.scheduleTodayTag}>Today</Text> : null)}
                </View>
              );
            })}
          </>
        )}

        {resolved.kind !== 'weekday' && programs.every((p) => p.schedule_mode !== 'weekday') && (
          <>
            <Text style={styles.sectionTitle}>Weekly Schedule</Text>
            {WEEKDAY_ORDER.map((wd) => {
              const entry = schedule.find((s) => s.weekday === wd);
              const plan = entry?.plan_id ? plans.find((p) => p.id === entry.plan_id) : null;
              const isToday = wd === new Date().getDay();
              return (
                <Pressable key={wd} style={[styles.scheduleRow, isToday && styles.scheduleRowToday]} onPress={() => setPickerWeekday(wd)}>
                  <Text style={styles.scheduleDay}>{WEEKDAY_LABELS[wd]}</Text>
                  <Text style={styles.schedulePlan}>{plan ? plan.name : 'Rest'}</Text>
                  {isToday && <Text style={styles.scheduleTodayTag}>Today</Text>}
                </Pressable>
              );
            })}
          </>
        )}

        {/* ── Zone 2: My Routines ── */}
        {programs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Programs</Text>
            <View style={styles.grid}>
              {programs.map((p) => {
                const theme = PLAN_THEMES[p.theme_key];
                const entries = programPlans.filter((e) => e.program_id === p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.programCard, { borderColor: theme.accent, backgroundColor: theme.surface }]}
                    onPress={() => setView({ mode: 'programDetail', programId: p.id })}
                  >
                    <Text style={styles.emoji}>{p.emoji ?? '💪'}</Text>
                    <Text style={styles.programName}>{p.name}</Text>
                    <Text style={styles.programSub}>
                      {entries.length} session{entries.length === 1 ? '' : 's'} • {p.schedule_mode === 'flexible' ? 'Flexible' : 'Weekday'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Saved & Custom Routines</Text>
        {standalonePlans.length === 0 ? (
          <Text style={styles.empty}>No standalone routines yet. Create one or use a starter template below.</Text>
        ) : (
          <View style={styles.grid}>
            {standalonePlans.map((p) => (
              <PlanCard
                key={p.id}
                emoji={p.emoji}
                name={p.name}
                subtitle={p.description || 'Tap to view'}
                themeKey={p.theme_key}
                onPress={() => setView({ mode: 'planDetail', planId: p.id })}
              />
            ))}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {/* ── Zone 3: Discoverability ── */}
        <Text style={styles.sectionTitle}>Smart Adjust</Text>
        <View style={styles.smartAdjustCard}>
          <AiUsageIndicator isPremium={aiGate.isPremium} remaining={aiGate.remaining} loaded={aiGate.loaded} />
          <Text style={styles.smartAdjustText}>Short on time or feeling fatigued? Recalibrate today's session on the fly.</Text>
          <Pressable style={styles.smartAdjustButton} onPress={() => setRecalibrateOpen(true)}>
            <Text style={styles.smartAdjustButtonText}>⚡ Recalibrate Today's Session</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Starter Templates</Text>
        <Text style={styles.hint}>Built from your real exercise catalog — not community content.</Text>
        {templateResult && <Text style={styles.templateResult}>{templateResult}</Text>}
        <View style={styles.grid}>
          {STARTER_TEMPLATES.map((t) => (
            <View key={t.key} style={styles.templateCard}>
              <Text style={styles.templateTitle}>{t.title}</Text>
              <Text style={styles.templateSummary}>{t.summary}</Text>
              <Pressable
                style={styles.templateButton}
                onPress={() => applyTemplate(t)}
                disabled={applyingTemplateKey === t.key}
              >
                {applyingTemplateKey === t.key ? (
                  <ActivityIndicator color="#0a0a0a" />
                ) : (
                  <Text style={styles.templateButtonText}>Use Template</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <SessionRecalibrationModal
        visible={recalibrateOpen}
        onClose={() => setRecalibrateOpen(false)}
        personality={personality}
        canUse={aiGate.canUse}
        onUsed={aiGate.refresh}
      />

      <Modal visible={pickerWeekday != null} transparent animationType="fade" onRequestClose={() => setPickerWeekday(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerWeekday(null)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{pickerWeekday != null ? WEEKDAY_LABELS[pickerWeekday] : ''} plan</Text>
            <Pressable style={styles.pickerOption} onPress={() => pickerWeekday != null && assignDay(pickerWeekday, null)}>
              <Text style={styles.pickerOptionText}>Rest</Text>
            </Pressable>
            {standalonePlans.map((p) => (
              <Pressable key={p.id} style={styles.pickerOption} onPress={() => pickerWeekday != null && assignDay(pickerWeekday, p.id)}>
                <Text style={styles.pickerOptionText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function weekdayDate(weekday: number): Date {
  const start = startOfWeek(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === weekday) return d;
  }
  return new Date();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  centered: { flex: 1, backgroundColor: dark.background, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  formContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, backgroundColor: dark.background, flexGrow: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerButtons: { flexDirection: 'row', gap: 16 },
  title: { color: dark.text, fontSize: 22, fontWeight: '700' },
  newPlan: { color: dark.accent, fontWeight: '600' },
  back: { color: dark.accent, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  hint: { color: dark.textFaint, fontSize: 12, marginBottom: 12 },
  label: { color: dark.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: { borderWidth: 1, borderColor: dark.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, flex: 1 },
  modeChipActive: { borderColor: dark.accent, backgroundColor: dark.surfaceElevated },
  modeChipText: { color: dark.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modeChipTextActive: { color: dark.accent },
  empty: { color: dark.textFaint, textAlign: 'center', marginBottom: 12 },
  error: { color: dark.danger, marginBottom: 12 },
  heroCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 20 },
  heroLabel: { color: dark.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  heroEmoji: { fontSize: 34, marginBottom: 4 },
  heroTitle: { color: dark.text, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  heroProgress: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 8, textAlign: 'center' },
  heroSubtitle: { color: dark.textMuted, fontSize: 13, marginTop: 10, textAlign: 'center' },
  heroButton: { backgroundColor: dark.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 14 },
  heroButtonText: { color: '#0a0a0a', fontWeight: '800' },
  sectionTitle: { color: dark.text, fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 18 },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dark.border,
    backgroundColor: dark.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6,
  },
  scheduleRowToday: { borderColor: dark.accent },
  scheduleDay: { color: dark.textFaint, fontSize: 12, fontWeight: '700', width: 44 },
  schedulePlan: { color: dark.text, fontSize: 14, fontWeight: '600', flex: 1 },
  scheduleTodayTag: { color: dark.accent, fontSize: 10, fontWeight: '700' },
  scheduleDone: { color: dark.accent, fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  programCard: { borderWidth: 1, borderRadius: 16, padding: 14, minWidth: 160, flex: 1 },
  emoji: { fontSize: 26, marginBottom: 6 },
  programName: { color: dark.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  programSub: { color: dark.textMuted, fontSize: 12 },
  smartAdjustCard: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 16, padding: 16 },
  smartAdjustText: { color: dark.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 14 },
  smartAdjustButton: { backgroundColor: dark.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  smartAdjustButtonText: { color: '#0a0a0a', fontWeight: '700' },
  templateResult: { color: dark.accent, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  templateCard: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 16, padding: 14, minWidth: 160, flex: 1 },
  templateTitle: { color: dark.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  templateSummary: { color: dark.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  templateButton: { borderWidth: 1, borderColor: dark.accent, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  templateButtonText: { color: dark.accent, fontWeight: '700', fontSize: 12 },
  input: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, color: dark.text, borderRadius: 8, padding: 12, marginTop: 16, fontSize: 16 },
  createButton: { backgroundColor: dark.accent, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  createButtonText: { color: '#0a0a0a', fontWeight: '700' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  pickerCard: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, borderRadius: 16, padding: 16, maxHeight: '70%' },
  pickerTitle: { color: dark.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  pickerOption: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: dark.border },
  pickerOptionText: { color: dark.text, fontSize: 14 },
});
