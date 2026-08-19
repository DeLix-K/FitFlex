import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';
import { supabase } from '../lib/supabase';

export type Tab =
  | 'dashboard'
  | 'coach'
  | 'streaks'
  | 'challenges'
  | 'wearables'
  | 'sleep'
  | 'habits'
  | 'wellness'
  | 'exercises'
  | 'plans'
  | 'scan'
  | 'foodScan'
  | 'nutrition'
  | 'history'
  | 'trainers'
  | 'trainerDashboard'
  | 'courses'
  | 'digitalProducts'
  | 'merch'
  | 'profile'
  | 'videos';

const ADMIN_EMAIL = 'teamlix6@gmail.com';

const BASE_TABS: { label: string; value: Tab }[] = [
  { label: 'Home', value: 'dashboard' },
  { label: 'Coach', value: 'coach' },
  { label: 'Streaks', value: 'streaks' },
  { label: 'Challenges', value: 'challenges' },
  { label: 'Wearables', value: 'wearables' },
  { label: 'Sleep', value: 'sleep' },
  { label: 'Habits', value: 'habits' },
  { label: 'Wellness', value: 'wellness' },
  { label: 'Exercises', value: 'exercises' },
  { label: 'My Plans', value: 'plans' },
  { label: 'Scan Equipment', value: 'scan' },
  { label: 'Scan Food', value: 'foodScan' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Trainers', value: 'trainers' },
  { label: 'Courses', value: 'courses' },
  { label: 'Guides & Plans', value: 'digitalProducts' },
  { label: 'Merch', value: 'merch' },
  { label: 'History', value: 'history' },
  { label: 'Profile', value: 'profile' },
];

const ADMIN_TABS: { label: string; value: Tab }[] = [
  ...BASE_TABS,
  { label: 'Manage Videos', value: 'videos' },
];

export default function AppShell({
  session,
  activeTab,
  onChangeTab,
  children,
}: {
  session: Session;
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  children: ReactNode;
}) {
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('is_trainer')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setIsTrainer(!!data?.is_trainer));
  }, [session.user.id]);

  const baseTabs = session.user.email === ADMIN_EMAIL ? ADMIN_TABS : BASE_TABS;
  const tabs = isTrainer
    ? [...baseTabs, { label: 'Trainer Dashboard', value: 'trainerDashboard' as Tab }]
    : baseTabs;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FitFlex</Text>
          <Text style={styles.subtitle}>{session.user.email}</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Sign Out</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={styles.tabRowContent}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.value}
            style={[styles.tab, activeTab === tab.value && styles.tabActive]}
            onPress={() => onChangeTab(tab.value)}
          >
            <Text style={[styles.tabText, activeTab === tab.value && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: dark.text,
  },
  subtitle: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 2,
  },
  signOut: {
    color: dark.danger,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  tabRow: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  tabRowContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 10,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: dark.accent,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: dark.textFaint,
  },
  tabTextActive: {
    color: dark.accent,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
