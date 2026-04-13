import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Audio } from 'expo-av'
import { useRouter } from 'expo-router'
import { useAppStore } from '../../src/store/authStore'
import { supabase } from '../../src/lib/supabase'
import { apiPost, API_BASE } from '../../src/lib/api'
import { detectNavigationIntent } from '../../src/hooks/useNavigationIntent'
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus'
import { useSmartCorrection } from '../../src/hooks/useSmartCorrection'
import { savePendingSession, getPendingSessions, clearPendingSession } from '../../src/lib/offlineStore'
import { COLORS, RADIUS } from '../../src/lib/theme'

type State = 'idle' | 'listening' | 'processing' | 'done' | 'error'
type Lang  = 'en' | 'lg'

const STEPS = ['Cleaning audio', 'Transcribing speech', 'Reconstructing text', 'Generating voice']

export default function VoiceScreen() {
  const router   = useRouter()
  const user     = useAppStore(s => s.user)
  const { isOnline } = useNetworkStatus()
  const { correct }  = useSmartCorrection()

  const [state,       setState]      = useState<State>('idle')
  const [language,    setLanguage]   = useState<Lang>('en')
  const [step,        setStep]       = useState(-1)
  const [result,      setResult]     = useState<any>(null)
  const [suggestion,  setSuggestion] = useState<string | null>(null)
  const [error,       setError]      = useState('')
  const [pendingCount,setPendingCount] = useState(0)
  const [syncing,     setSyncing]    = useState(false)

  const recordingRef = useRef<Audio.Recording | null>(null)

  // Load pending count on mount
  useState(() => {
    getPendingSessions().then(p => setPendingCount(p.length))
  })

  async function startRecording() {
    if (!isOnline) {
      Alert.alert(
        '📶 Offline Mode',
        'You\'re offline. Recording will be saved locally and synced when you reconnect.',
        [{ text: 'OK, Continue', onPress: doStartRecording }, { text: 'Cancel', style: 'cancel' }]
      )
      return
    }
    doStartRecording()
  }

  async function doStartRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted')
        return Alert.alert('Permission needed', 'Allow microphone access to use Voice Input')
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      recordingRef.current = recording
      setState('listening')
      setError('')
      setResult(null)
      setSuggestion(null)
    } catch {
      Alert.alert('Error', 'Could not start recording')
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return
    setState('processing')
    try {
      await recordingRef.current.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      const uri = recordingRef.current.getURI()
      recordingRef.current = null
      if (uri) await processAudio(uri)
    } catch {
      setState('error'); setError('Recording failed')
    }
  }

  async function processAudio(uri: string) {
    // Animate steps
    let stepIdx = 0
    const stepInterval = setInterval(() => {
      setStep(stepIdx++)
      if (stepIdx >= STEPS.length) clearInterval(stepInterval)
    }, 600)

    if (!isOnline) {
      // OFFLINE: save recording locally for later sync
      clearInterval(stepInterval)
      setStep(-1)
      if (user?.id) {
        await savePendingSession({
          user_id:     user.id,
          transcript:  '[Recorded offline — pending transcription]',
          clean_text:  '[Will be processed when back online]',
          language,
          confidence:  null,
          pipeline_ms: null,
          created_at:  new Date().toISOString(),
        })
        const pending = await getPendingSessions()
        setPendingCount(pending.length)
      }
      setState('error')
      setError('You\'re offline. Recording saved locally — it will sync when you reconnect.')
      return
    }

    try {
      const form = new FormData()
      form.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any)
      form.append('language',    language)
      form.append('output_mode', 'visual')
      form.append('rate',        '1.0')
      form.append('pitch',       '0.5')

      const data = await apiPost<any>('/pipeline/process', form)
      clearInterval(stepInterval)
      setStep(-1)
      setResult(data)
      setState('done')

      // 🧠 AI Smart Correction — get suggestion for the clean text
      if (data.clean_text) {
        const correction = await correct(data.clean_text, language, isOnline)
        if (correction.changed && correction.corrected !== data.clean_text) {
          setSuggestion(correction.corrected)
        }
      }

      // Save to Supabase
      if (user?.id) {
        supabase.from('transcription_history').insert({
          user_id:     user.id,
          transcript:  data.raw_transcript  ?? '',
          clean_text:  data.clean_text      ?? '',
          language,
          confidence:  data.confidence      ?? null,
          pipeline_ms: data.pipeline_ms     ?? null,
          created_at:  new Date().toISOString(),
        }).then(({ error: e }) => { if (e) console.warn('Save failed:', e.message) })
      }

      // Navigation intent
      const intent = detectNavigationIntent(data.clean_text ?? data.raw_transcript ?? '')
      if (intent.isNavigation && intent.confidence >= 0.65) {
        setTimeout(() =>
          router.push({ pathname: '/(tabs)/navigate', params: { destination: intent.destination } }),
        1200)
      }
    } catch (e: any) {
      clearInterval(stepInterval)
      setStep(-1)
      setState('error')
      setError(e?.message ?? 'Pipeline failed. Is the backend running?')
    }
  }

  // Sync pending offline sessions when back online
  async function syncPending() {
    const pending = await getPendingSessions()
    if (!pending.length) return
    setSyncing(true)
    let synced = 0
    for (const s of pending) {
      const { error } = await supabase.from('transcription_history').insert({
        user_id:     s.user_id,
        transcript:  s.transcript,
        clean_text:  s.clean_text,
        language:    s.language,
        confidence:  s.confidence,
        pipeline_ms: s.pipeline_ms,
        created_at:  s.created_at,
      })
      if (!error) { await clearPendingSession(s.id); synced++ }
    }
    const remaining = await getPendingSessions()
    setPendingCount(remaining.length)
    setSyncing(false)
    Alert.alert('✅ Synced', `${synced} session${synced !== 1 ? 's' : ''} uploaded`)
  }

  function orbPress() {
    if (state === 'idle' || state === 'error') startRecording()
    else if (state === 'listening') stopRecording()
  }

  const orbColor = state === 'listening' ? COLORS.red
    : state === 'processing' ? COLORS.muted : COLORS.teal

  const stateLabel: Record<State, string> = {
    idle: 'Tap to speak', listening: 'Listening…',
    processing: 'Processing…', done: 'Done ✓', error: 'Error',
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.heading}>Voice Assistant</Text>
        <Text style={s.sub}>Speak naturally in English or Luganda</Text>

        {/* Offline / pending banners */}
        {!isOnline && (
          <View style={s.offlineBanner}>
            <Text style={s.offlineText}>📶 Offline — limited features available</Text>
          </View>
        )}
        {isOnline && pendingCount > 0 && (
          <TouchableOpacity style={s.syncBanner} onPress={syncPending} disabled={syncing}>
            {syncing
              ? <ActivityIndicator color={COLORS.teal2} size="small" />
              : <Text style={s.syncText}>☁️ {pendingCount} offline recording{pendingCount !== 1 ? 's' : ''} — tap to sync</Text>}
          </TouchableOpacity>
        )}

        {/* Language toggle */}
        <View style={s.langRow}>
          {(['en', 'lg'] as Lang[]).map(l => (
            <TouchableOpacity key={l} style={[s.langBtn, language === l && s.langActive]}
              onPress={() => setLanguage(l)}>
              <Text style={[s.langText, language === l && s.langActiveText]}>
                {l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Orb */}
        <View style={s.orbWrap}>
          <TouchableOpacity
            style={[s.orb, { backgroundColor: orbColor }]}
            onPress={orbPress}
            disabled={state === 'processing'}
            activeOpacity={0.85}
          >
            {state === 'processing'
              ? <ActivityIndicator color="#fff" size="large" />
              : <Text style={{ fontSize: 40 }}>{state === 'listening' ? '⏹' : '🎙️'}</Text>}
          </TouchableOpacity>
          <Text style={[s.orbLabel, state === 'error' && { color: COLORS.red }]}>
            {stateLabel[state]}
          </Text>
          {!isOnline && state === 'idle' && (
            <Text style={s.offlineHint}>Offline: recordings saved locally</Text>
          )}
        </View>

        {/* Processing steps */}
        {state === 'processing' && (
          <View style={s.stepsCard}>
            {STEPS.map((label, i) => (
              <View key={label} style={s.stepRow}>
                <Text style={{ fontSize: 14, marginRight: 8 }}>
                  {step > i ? '✅' : step === i ? '⏳' : '⬜'}
                </Text>
                <Text style={[s.stepText, step === i && { color: COLORS.teal2 }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Result */}
        {state === 'done' && result && (
          <View style={s.resultCard}>
            {result.confidence > 0 && (
              <View style={s.confidenceBadge}>
                <Text style={s.confidenceText}>⚡ {Math.round(result.confidence * 100)}% confidence</Text>
              </View>
            )}

            {result.raw_transcript !== result.clean_text && (
              <View style={s.rawBox}>
                <Text style={s.rawLabel}>RAW</Text>
                <Text style={s.rawText}>"{result.raw_transcript}"</Text>
              </View>
            )}

            <View style={s.cleanBox}>
              <Text style={s.cleanLabel}>CLEANED TEXT</Text>
              <Text style={s.cleanText}>"{result.clean_text}"</Text>
            </View>

            {/* 🧠 AI Smart Correction suggestion */}
            {suggestion && (
              <View style={s.suggestionBox}>
                <Text style={s.suggestionLabel}>🧠 AI Suggestion</Text>
                <Text style={s.suggestionText}>"{suggestion}"</Text>
                <View style={s.suggestionBtns}>
                  <TouchableOpacity style={s.acceptBtn}
                    onPress={() => { setResult({ ...result, clean_text: suggestion }); setSuggestion(null) }}>
                    <Text style={s.acceptBtnText}>✓ Use This</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.dismissBtn} onPress={() => setSuggestion(null)}>
                    <Text style={s.dismissBtnText}>✕ Keep Original</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={s.copyBtn}
              onPress={() => { Clipboard.setString(result.clean_text); Alert.alert('Copied!') }}>
              <Text style={s.copyBtnText}>📋 Copy Text</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {state === 'error' && (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{error}</Text>
            {error.includes('backend') && <Text style={s.errorHint}>Backend: {API_BASE}</Text>}
          </View>
        )}

        {(state === 'done' || state === 'error') && (
          <TouchableOpacity style={s.resetBtn}
            onPress={() => { setState('idle'); setResult(null); setError(''); setSuggestion(null) }}>
            <Text style={s.resetText}>🔄 Record Again</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.bg },
  scroll:          { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },
  heading:         { color: COLORS.text, fontWeight: '800', fontSize: 22, marginTop: 16, marginBottom: 4 },
  sub:             { color: COLORS.subtle, fontSize: 13, marginBottom: 12 },
  offlineBanner:   { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: RADIUS.lg, padding: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginBottom: 10 },
  offlineText:     { color: COLORS.amber, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  syncBanner:      { backgroundColor: 'rgba(11,148,136,0.1)', borderRadius: RADIUS.lg, padding: 10, borderWidth: 1, borderColor: 'rgba(11,148,136,0.3)', marginBottom: 10, alignItems: 'center' },
  syncText:        { color: COLORS.teal2, fontSize: 13, fontWeight: '600' },
  langRow:         { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  langBtn:         { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.lg },
  langActive:      { backgroundColor: COLORS.teal },
  langText:        { color: COLORS.subtle, fontSize: 13, fontWeight: '600' },
  langActiveText:  { color: '#fff' },
  orbWrap:         { alignItems: 'center', marginVertical: 28 },
  orb:             { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.teal, shadowOpacity: 0.6, shadowRadius: 24, elevation: 12 },
  orbLabel:        { color: COLORS.text, fontWeight: '600', fontSize: 15, marginTop: 16 },
  offlineHint:     { color: COLORS.amber, fontSize: 11, marginTop: 6 },
  stepsCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  stepRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  stepText:        { color: COLORS.muted, fontSize: 13 },
  resultCard:      { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  confidenceBadge: { alignSelf: 'center', backgroundColor: 'rgba(11,148,136,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  confidenceText:  { color: COLORS.teal2, fontSize: 12, fontWeight: '600' },
  rawBox:          { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.lg, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  rawLabel:        { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  rawText:         { color: COLORS.muted, fontSize: 13, fontStyle: 'italic' },
  cleanBox:        { backgroundColor: 'rgba(11,148,136,0.06)', borderRadius: RADIUS.lg, padding: 12, borderWidth: 1, borderColor: 'rgba(11,148,136,0.25)' },
  cleanLabel:      { color: COLORS.teal2, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  cleanText:       { color: COLORS.text, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  suggestionBox:   { backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)' },
  suggestionLabel: { color: '#a5b4fc', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  suggestionText:  { color: COLORS.text, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  suggestionBtns:  { flexDirection: 'row', gap: 8 },
  acceptBtn:       { flex: 1, backgroundColor: COLORS.teal, borderRadius: RADIUS.lg, paddingVertical: 9, alignItems: 'center' },
  acceptBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  dismissBtn:      { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  dismissBtnText:  { color: COLORS.subtle, fontSize: 13 },
  copyBtn:         { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  copyBtnText:     { color: COLORS.teal2, fontWeight: '600', fontSize: 13 },
  errorCard:       { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 16 },
  errorText:       { color: COLORS.red, fontSize: 13, marginBottom: 4 },
  errorHint:       { color: COLORS.muted, fontSize: 11 },
  resetBtn:        { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  resetText:       { color: COLORS.text, fontWeight: '600', fontSize: 15 },
})