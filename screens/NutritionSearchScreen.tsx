import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import { useAiGate } from '../hooks/useAiGate';
import { saveHistoryEntry } from '../lib/aiHistory';
import { askClaude, buildNutritionSearchPrompt } from '../lib/claude';
import { colors } from '../lib/theme';
import { formatUsdaMatch, searchUsdaFoods, type UsdaFoodMatch } from '../lib/usda';

export default function NutritionSearchScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<UsdaFoodMatch[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aiGate = useAiGate();

  const askAi = async (searchedQuery: string) => {
    if (!aiGate.canUse) {
      setMatches([]);
      setError("You've used today's free AI actions. Upgrade to Premium for unlimited access.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const reply = await askClaude(buildNutritionSearchPrompt(searchedQuery));
      setResult(reply);
      setMatches([]);
      saveHistoryEntry('nutrition_search', reply, searchedQuery);
      aiGate.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMatches([]);

    try {
      const usdaMatches = await searchUsdaFoods(trimmed);
      if (usdaMatches.length > 0) {
        setMatches(usdaMatches);
        setLoading(false);
        return;
      }
    } catch {
      // USDA lookup failing shouldn't block the AI fallback below.
    }

    await askAi(trimmed);
  };

  const selectMatch = (match: UsdaFoodMatch) => {
    const formatted = formatUsdaMatch(match);
    setResult(formatted);
    setMatches([]);
    saveHistoryEntry('nutrition_search', formatted, query.trim());
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Nutrition Search</Text>
      <Text style={styles.subtitle}>
        Ask about a specific food, or describe what you're looking for — e.g. "chicken breast" or
        "high protein breakfast under 400 calories".
      </Text>

      <AiUsageIndicator
        isPremium={aiGate.isPremium}
        remaining={aiGate.remaining}
        loaded={aiGate.loaded}
      />

      <TextInput
        style={styles.input}
        placeholder="What do you want to know?"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={search}
        returnKeyType="search"
      />

      <Pressable style={styles.button} onPress={search} disabled={loading || !query.trim()}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Search</Text>}
      </Pressable>

      {error && <Text style={styles.error}>Couldn't get an answer: {error}</Text>}

      {matches.length > 0 && (
        <View style={styles.matchesBox}>
          <Text style={styles.matchesLabel}>Found in the USDA database — pick the closest match:</Text>
          {matches.map((match) => (
            <Pressable
              key={match.fdcId}
              style={styles.matchRow}
              onPress={() => selectMatch(match)}
            >
              <Text style={styles.matchDescription}>{match.description}</Text>
              <Text style={styles.matchCalories}>
                {match.calories !== null ? `${Math.round(match.calories)} kcal` : ''}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => askAi(query.trim())}>
            <Text style={styles.askAiInstead}>None of these — ask AI instead</Text>
          </Pressable>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#dc2626',
    marginTop: 16,
  },
  matchesBox: {
    marginTop: 20,
  },
  matchesLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  matchDescription: {
    fontSize: 14,
    color: '#333',
    flexShrink: 1,
    marginRight: 8,
  },
  matchCalories: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  askAiInstead: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  resultBox: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 21,
  },
});
