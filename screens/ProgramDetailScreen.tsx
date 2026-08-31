import { useCallback, useEffect, useRef, useState, type ElementRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import ProgramShareCard from '../components/ProgramShareCard';
import ThemeEmojiPicker from '../components/ThemeEmojiPicker';
import {
  addPlanToProgram,
  computeFlexibleProgress,
  computeWeekdayProgress,
  countCompletedSessionsForProgram,
  deleteProgram,
  fetchAllProgramPlans,
  fetchPlans,
  fetchWorkoutLogsInRange,
  PLAN_THEMES,
  removePlanFromProgram,
  setProgramPlanWeekday,
  updateProgram,
} from '../lib/plans';
import { supabase } from '../lib/supabase';
import { dark } from '../lib/theme';
import type { Program, ProgramPlanEntry, WorkoutPlan } from '../lib/types';

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

export default function ProgramDetailScreen({
  programId,
  onBack,
  onDeleted,
  onOpenPlan,
  onStartSession,
  isPremium,
}: {
  programId: string;
  onBack: () => void;
  onDeleted: () => void;
  onOpenPlan: (planId: string) => void;
  onStartSession: (planId: string, programId: string) => void;
  isPremium: boolean;
}) {
  const [program, setProgram] = useState<Program | null>(null);
  const [entries, setEntries] = useState<ProgramPlanEntry[]>([]);
  const [allPlans, setAllPlans] = useState<WorkoutPlan[]>([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addPickerVisible, setAddPickerVisible] = useState(false);
  const [weekdayPickerFor, setWeekdayPickerFor] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<ElementRef<typeof ViewShot>>(null);
  const durationDraftRef = useRef<string | null>(null);
  const deloadDraftRef = useRef<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [programResult, programPlans, plans, sessionsCount] = await Promise.all([
        supabase.from('programs').select('*').eq('id', programId).single(),
        fetchAllProgramPlans(),
        fetchPlans(),
        countCompletedSessionsForProgram(programId),
      ]);
      if (programResult.error) throw new Error(programResult.error.message);
      setProgram(programResult.data);
      setEntries(programPlans.filter((e) => e.program_id === programId));
      setAllPlans(plans);
      setCompletedSessions(sessionsCount);

      const weekStart = startOfWeek(new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const logs = await fetchWorkoutLogsInRange(toDateStr(weekStart), toDateStr(weekEnd));
      setLoggedDates(new Set(logs.map((l) => l.logged_date)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [programId]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const plansById = new Map(allPlans.map((p) => [p.id, p]));
  const memberPlanIds = new Set(entries.map((e) => e.plan_id));
  const availableToAdd = allPlans.filter((p) => !memberPlanIds.has(p.id));

  const handleAdd = async (planId: string) => {
    setAddPickerVisible(false);
    try {
      await addPlanToProgram(programId, planId, { orderIndex: entries.length });
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemove = async (entryId: string) => {
    try {
      await removePlanFromProgram(entryId);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSetWeekday = async (entryId: string, weekday: number | null) => {
    setWeekdayPickerFor(null);
    try {
      await setProgramPlanWeekday(entryId, weekday);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const reorder = async (index: number, direction: -1 | 1) => {
    const ordered = [...entries].sort((a, b) => a.order_index - b.order_index);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    setEntries(ordered);
    await Promise.all([
      supabase.from('program_plans').update({ order_index: index }).eq('id', ordered[index].id),
      supabase.from('program_plans').update({ order_index: targetIndex }).eq('id', ordered[targetIndex].id),
    ]);
  };

  const handleDelete = async () => {
    try {
      await deleteProgram(programId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleShare = async () => {
    setSharing(true);
    setError(null);
    try {
      if (!shareCardRef.current) throw new Error('Nothing to share yet.');
      const uri = await shareCardRef.current.capture?.();
      if (!uri) throw new Error('Could not generate the share image.');
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  };

  if (loading || !program) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  const theme = PLAN_THEMES[program.theme_key];
  const orderedEntries = [...entries].sort((a, b) => a.order_index - b.order_index);
  const isFlexible = program.schedule_mode === 'flexible';

  const weekdayProgress = !isFlexible ? computeWeekdayProgress(program, entries, loggedDates) : null;
  const flexProgress = isFlexible ? computeFlexibleProgress(entries, completedSessions) : null;

  let progressLine = '';
  let statLines: string[] = [];
  if (isFlexible && flexProgress) {
    progressLine = `SESSION ${(flexProgress.completedSessions % Math.max(1, flexProgress.totalSessions)) + 1} OF ${flexProgress.totalSessions}`;
    statLines = [
      `${flexProgress.completedSessions} session${flexProgress.completedSessions === 1 ? '' : 's'} completed`,
      `Cycle ${flexProgress.cycleNumber}`,
    ];
  } else if (weekdayProgress) {
    progressLine = weekdayProgress.weekNumber
      ? `WEEK ${weekdayProgress.weekNumber}${weekdayProgress.totalWeeks ? ` OF ${weekdayProgress.totalWeeks}` : ''}${weekdayProgress.isDeloadWeek ? ' • DELOAD' : ''}`
      : 'ONGOING PROGRAM';
    statLines = [`${weekdayProgress.thisWeekDone} of ${weekdayProgress.thisWeekScheduled} sessions this week`];
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orderedEntries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Pressable onPress={onBack}>
              <Text style={styles.back}>{'< My Plans'}</Text>
            </Pressable>

            <View style={[styles.heroCard, { borderColor: theme.accent, backgroundColor: theme.surface }]}>
              <Text style={styles.heroEmoji}>{program.emoji ?? '💪'}</Text>
              <Text style={styles.heroTitle}>{program.name}</Text>
              {progressLine ? <Text style={[styles.heroProgress, { color: theme.accent }]}>{progressLine}</Text> : null}
              {statLines.map((line) => (
                <Text key={line} style={styles.heroStat}>
                  {line}
                </Text>
              ))}
              <Pressable style={styles.shareButton} onPress={handleShare} disabled={sharing}>
                {sharing ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.shareButtonText}>📤 Share Program Card</Text>}
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.actionChip} onPress={() => setCustomizeOpen((v) => !v)}>
                <Text style={styles.actionChipText}>🎨 {customizeOpen ? 'Hide Settings' : 'Program Settings'}</Text>
              </Pressable>
              <Pressable style={styles.actionChip} onPress={() => setAddPickerVisible(true)}>
                <Text style={styles.actionChipText}>+ Add Plan</Text>
              </Pressable>
            </View>

            {customizeOpen && (
              <View style={styles.customizeBox}>
                <Text style={styles.label}>Schedule mode</Text>
                <View style={styles.row}>
                  {(['weekday', 'flexible'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.modeChip, program.schedule_mode === mode && styles.modeChipActive]}
                      onPress={async () => {
                        setProgram({ ...program, schedule_mode: mode });
                        await updateProgram(programId, { scheduleMode: mode });
                        fetchAll();
                      }}
                    >
                      <Text style={[styles.modeChipText, program.schedule_mode === mode && styles.modeChipTextActive]}>
                        {mode === 'weekday' ? 'Fixed Weekdays' : 'Flexible (Session 1, 2, 3...)'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Duration (weeks, optional)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="e.g. 8"
                  placeholderTextColor={dark.textFaint}
                  defaultValue={program.duration_weeks != null ? String(program.duration_weeks) : ''}
                  onChangeText={(text) => { durationDraftRef.current = text; }}
                  onBlur={() => {
                    const v = (durationDraftRef.current ?? '').trim();
                    const parsed = v === '' ? null : Number(v);
                    updateProgram(programId, { durationWeeks: Number.isNaN(parsed as number) ? null : parsed });
                  }}
                />

                <Text style={styles.label}>Deload every N weeks (optional)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="e.g. 5"
                  placeholderTextColor={dark.textFaint}
                  defaultValue={program.deload_interval_weeks != null ? String(program.deload_interval_weeks) : ''}
                  onChangeText={(text) => { deloadDraftRef.current = text; }}
                  onBlur={() => {
                    const v = (deloadDraftRef.current ?? '').trim();
                    const parsed = v === '' ? null : Number(v);
                    updateProgram(programId, { deloadIntervalWeeks: Number.isNaN(parsed as number) ? null : parsed });
                  }}
                />

                <ThemeEmojiPicker
                  themeKey={program.theme_key}
                  emoji={program.emoji}
                  isPremium={isPremium}
                  onChangeTheme={async (themeKey) => {
                    setProgram({ ...program, theme_key: themeKey });
                    await updateProgram(programId, { themeKey });
                  }}
                  onChangeEmoji={async (emoji) => {
                    setProgram({ ...program, emoji });
                    await updateProgram(programId, { emoji });
                  }}
                />
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.sectionTitle}>Sessions in this program</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>No plans added yet. Tap "+ Add Plan" above.</Text>}
        renderItem={({ item, index }) => {
          const plan = plansById.get(item.plan_id);
          const isNextFlexible = isFlexible && flexProgress?.nextEntry?.id === item.id;
          const isToday = !isFlexible && item.weekday === new Date().getDay();
          const isUpNext = isNextFlexible || isToday;
          return (
            <View style={[styles.entryRow, isUpNext && styles.entryRowNext]}>
              <Pressable style={styles.entryMain} onPress={() => plan && onOpenPlan(plan.id)}>
                <Text style={styles.entryEmoji}>{plan?.emoji ?? '💪'}</Text>
                <View style={styles.entryTextWrap}>
                  <Text style={styles.entryName}>{plan?.name ?? 'Unknown plan'}</Text>
                  {isUpNext && <Text style={styles.entryNextTag}>{isToday ? '📍 Today' : '▶ Up next'}</Text>}
                </View>
              </Pressable>

              {isUpNext && plan && (
                <Pressable style={styles.startChip} onPress={() => onStartSession(plan.id, programId)}>
                  <Text style={styles.startChipText}>▶ Start</Text>
                </Pressable>
              )}

              {!isFlexible && (
                <Pressable style={styles.dayChip} onPress={() => setWeekdayPickerFor(item.id)}>
                  <Text style={styles.dayChipText}>{item.weekday != null ? WEEKDAY_LABELS[item.weekday] : 'Set day'}</Text>
                </Pressable>
              )}

              {isFlexible && (
                <View style={styles.reorderButtons}>
                  <Pressable onPress={() => reorder(index, -1)} disabled={index === 0}>
                    <Text style={[styles.reorderText, index === 0 && styles.reorderDisabled]}>Up</Text>
                  </Pressable>
                  <Pressable onPress={() => reorder(index, 1)} disabled={index === orderedEntries.length - 1}>
                    <Text style={[styles.reorderText, index === orderedEntries.length - 1 && styles.reorderDisabled]}>
                      Down
                    </Text>
                  </Pressable>
                </View>
              )}

              <Pressable onPress={() => handleRemove(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          confirmingDelete ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>Delete this program?</Text>
              <Pressable onPress={handleDelete}>
                <Text style={styles.confirmYes}>Yes, delete</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmingDelete(false)}>
                <Text style={styles.confirmNo}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmingDelete(true)}>
              <Text style={styles.deleteProgram}>Delete Program (plans stay saved)</Text>
            </Pressable>
          )
        }
      />

      <View style={styles.offscreen} pointerEvents="none">
        <ProgramShareCard
          ref={shareCardRef}
          emoji={program.emoji}
          title={program.name}
          themeKey={program.theme_key}
          progressLine={progressLine}
          statLines={statLines}
        />
      </View>

      <Modal visible={addPickerVisible} transparent animationType="fade" onRequestClose={() => setAddPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setAddPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Add a plan to this program</Text>
            {availableToAdd.length === 0 ? (
              <Text style={styles.empty}>All your plans are already in this program.</Text>
            ) : (
              availableToAdd.map((p) => (
                <Pressable key={p.id} style={styles.pickerOption} onPress={() => handleAdd(p.id)}>
                  <Text style={styles.pickerOptionText}>
                    {p.emoji ?? '💪'} {p.name}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={weekdayPickerFor != null} transparent animationType="fade" onRequestClose={() => setWeekdayPickerFor(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setWeekdayPickerFor(null)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Which day?</Text>
            <Pressable style={styles.pickerOption} onPress={() => weekdayPickerFor && handleSetWeekday(weekdayPickerFor, null)}>
              <Text style={styles.pickerOptionText}>Unassigned</Text>
            </Pressable>
            {WEEKDAY_ORDER.map((wd) => (
              <Pressable key={wd} style={styles.pickerOption} onPress={() => weekdayPickerFor && handleSetWeekday(weekdayPickerFor, wd)}>
                <Text style={styles.pickerOptionText}>{WEEKDAY_LABELS[wd]}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  centered: { flex: 1, backgroundColor: dark.background, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  back: { color: dark.accent, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  heroCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 16 },
  heroEmoji: { fontSize: 40, marginBottom: 6 },
  heroTitle: { color: dark.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroProgress: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 8 },
  heroStat: { color: dark.textMuted, fontSize: 12, marginTop: 4 },
  shareButton: { backgroundColor: dark.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, marginTop: 14 },
  shareButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  actionChip: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  actionChipText: { color: dark.text, fontSize: 12, fontWeight: '700' },
  customizeBox: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 14, padding: 14, marginBottom: 14 },
  label: { color: dark.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: { borderWidth: 1, borderColor: dark.border, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, flex: 1 },
  modeChipActive: { borderColor: dark.accent, backgroundColor: dark.surfaceElevated },
  modeChipText: { color: dark.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modeChipTextActive: { color: dark.accent },
  input: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.background, color: dark.text, borderRadius: 8, padding: 10, fontSize: 14 },
  error: { color: dark.danger, marginBottom: 12 },
  empty: { color: dark.textFaint, textAlign: 'center', paddingVertical: 12 },
  sectionTitle: { color: dark.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dark.border,
    backgroundColor: dark.surface, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10,
  },
  entryRowNext: { borderColor: dark.accent },
  entryMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  entryEmoji: { fontSize: 22 },
  entryTextWrap: { flex: 1 },
  entryName: { color: dark.text, fontSize: 15, fontWeight: '700' },
  entryNextTag: { color: dark.accent, fontSize: 11, fontWeight: '700', marginTop: 2 },
  startChip: { backgroundColor: dark.accent, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  startChipText: { color: '#0a0a0a', fontSize: 11, fontWeight: '800' },
  dayChip: { borderWidth: 1, borderColor: dark.border, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  dayChipText: { color: dark.textMuted, fontSize: 11, fontWeight: '700' },
  reorderButtons: { flexDirection: 'row', gap: 10 },
  reorderText: { color: dark.accent, fontSize: 12, fontWeight: '600' },
  reorderDisabled: { color: dark.textFaint },
  remove: { color: dark.danger, fontSize: 12, fontWeight: '600' },
  deleteProgram: { color: dark.danger, textAlign: 'center', marginTop: 20, marginBottom: 24, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20, marginBottom: 24 },
  confirmText: { color: dark.textMuted },
  confirmYes: { color: dark.danger, fontWeight: '700' },
  confirmNo: { color: dark.textMuted, fontWeight: '600' },
  offscreen: { position: 'absolute', top: -9999, left: -9999 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  pickerCard: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, borderRadius: 16, padding: 16, maxHeight: '70%' },
  pickerTitle: { color: dark.text, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  pickerOption: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: dark.border },
  pickerOptionText: { color: dark.text, fontSize: 14 },
});
