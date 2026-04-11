import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Audio } from 'expo-av'
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus'
import { apiPost } from '../../src/lib/api'
import { COLORS, RADIUS } from '../../src/lib/theme'

const VOICES = [
  { id: 'female', emoji: '👩', label: 'Female' },
  { id: 'male',   emoji: '👨', label: 'Male'   },
  { id: 'robot',  emoji: '🤖', label: 'Robot'  },
]
const QUICK_PHRASES = [
  'Where is the exit?',
  'I need a wheelchair.',
  'Please call a doctor.',
  'I need help finding the bathroom.',
  'Can someone assist me please?',
  'Take me to Kampala CBD.',
  'I need to go to Mulago Hospital.',
]
const CHAR_LIMIT = 300

export default function TTSScreen() {
  const { isOnline } = useNetworkStatus()
  const [text,    setText]    = useState('')
  const [voice,   setVoice]   = useState('female')
  const [pitch,   setPitch]   = useState(50)
  const [rate,    setRate]    = useState(60)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)

  async function handleSpeak() {
    if (!text.trim()) return Alert.alert('Empty', 'Enter some text first')

    if (!isOnline) {
      Alert.alert(
        '📶 Offline',
        'Backend TTS requires internet. Connect to use full voice synthesis.'
      )
      return
    }

    setLoading(true)
    try {
      const data = await apiPost<any>('/tts/synthesize', {
        text,
        voice,
        pitch: pitch / 100,
        rate:  rate  / 100,
      })

      if (data.audio_base64) {
        // Stop any current playback
        if (soundRef.current) {
          await soundRef.current.stopAsync()
          await soundRef.current.unloadAsync()
        }
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${data.audio_base64}` },
          { shouldPlay: true }
        )
        soundRef.current = sound
        setPlaying(true)
        sound.setOnPlaybackStatusUpdate(st => {
          if (st.isLoaded && st.didJustFinish) {
            setPlaying(false)
            sound.unloadAsync()
            soundRef.current = null
          }
        })
      }
    } catch (e: any) {
      Alert.alert('TTS Error', e?.message ?? 'Backend TTS not available.\nIs the server running?')
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    if (soundRef.current) {
      await soundRef.current.stopAsync()
      await soundRef.current.unloadAsync()
      soundRef.current = null
    }
    setPlaying(false)
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Text to Speech</Text>
        <Text style={s.sub}>Type and hear it spoken</Text>

        {!isOnline && (
          <View style={s.offlineBanner}>
            <Text style={s.offlineText}>📶 Offline — connect to use voice synthesis</Text>
          </View>
        )}

        {/* Text input */}
        <View style={s.inputCard}>
          <View style={s.inputTop}>
            <Text style={s.inputLabel}>🔊 YOUR MESSAGE</Text>
            <Text style={[s.charCount, text.length > CHAR_LIMIT * 0.8 && { color: COLORS.red }]}>
              {text.length}/{CHAR_LIMIT}
            </Text>
          </View>
          <TextInput
            style={s.textarea}
            placeholder="Type what you want to say…"
            placeholderTextColor={COLORS.muted}
            value={text}
            onChangeText={t => setText(t.slice(0, CHAR_LIMIT))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Voice picker */}
        <View style={s.voiceRow}>
          {VOICES.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[s.voiceBtn, voice === v.id && s.voiceBtnActive]}
              onPress={() => setVoice(v.id)}
            >
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{v.emoji}</Text>
              <Text style={[s.voiceLabel, voice === v.id && s.voiceLabelActive]}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pitch & Speed controls */}
        <View style={s.sliderCard}>
          {[
            { label: '🎵 Pitch', value: pitch, set: setPitch },
            { label: '⚡ Speed', value: rate,  set: setRate  },
          ].map(({ label, value, set }) => (
            <View key={label} style={s.sliderRow}>
              <View style={s.sliderLabelRow}>
                <Text style={s.sliderLabel}>{label}</Text>
                <Text style={s.sliderValue}>{value}%</Text>
              </View>
              <View style={s.sliderTrack}>
                <View style={[s.sliderFill, { width: `${value}%` as any }]} />
              </View>
              <View style={s.sliderBtns}>
                {[10, 20, 30, 50, 70, 80, 90, 100].map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[s.presetBtn, value === v && s.presetBtnActive]}
                    onPress={() => set(v)}
                  >
                    <Text style={[s.presetBtnText, value === v && s.presetBtnTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Speak / Stop button */}
        <TouchableOpacity
          style={[s.speakBtn, playing && s.speakBtnStop, (!isOnline) && s.speakBtnDisabled]}
          onPress={playing ? handleStop : handleSpeak}
          disabled={loading || !isOnline}
          activeOpacity={0.85}
        >
          <Text style={[s.speakBtnText, playing && { color: COLORS.red }]}>
            {loading ? '⏳ Preparing…' : playing ? '⏹ Stop Speaking' : '🔊 Speak Text'}
          </Text>
        </TouchableOpacity>

        {/* Playing animation indicator */}
        {playing && (
          <View style={s.waveWrap}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={[s.wavebar, { height: 8 + (i % 4) * 8 }]} />
            ))}
          </View>
        )}

        {/* Quick phrases */}
        <Text style={s.sectionLabel}>QUICK PHRASES</Text>
        <View style={s.phrasesCard}>
          {QUICK_PHRASES.map((p, i) => (
            <TouchableOpacity
              key={p}
              style={[s.phrase, i < QUICK_PHRASES.length - 1 && s.phraseDivider]}
              onPress={() => setText(p)}
            >
              <Text style={s.phraseText}>{p}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.bg },
  scroll:           { flex: 1, paddingHorizontal: 20 },
  heading:          { color: COLORS.text, fontWeight: '800', fontSize: 22, marginTop: 16, marginBottom: 4 },
  sub:              { color: COLORS.subtle, fontSize: 13, marginBottom: 14 },
  offlineBanner:    { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: RADIUS.lg, padding: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginBottom: 14 },
  offlineText:      { color: COLORS.amber, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  inputCard:        { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  inputTop:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputLabel:       { color: COLORS.teal2, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  charCount:        { color: COLORS.muted, fontSize: 11 },
  textarea:         { color: COLORS.text, fontSize: 14, minHeight: 90, lineHeight: 20 },
  voiceRow:         { flexDirection: 'row', gap: 10, marginBottom: 14 },
  voiceBtn:         { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  voiceBtnActive:   { borderColor: COLORS.teal, backgroundColor: 'rgba(11,148,136,0.08)' },
  voiceLabel:       { color: COLORS.subtle, fontSize: 12 },
  voiceLabelActive: { color: COLORS.teal2, fontWeight: '600' },
  sliderCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, gap: 18 },
  sliderRow:        { gap: 8 },
  sliderLabelRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel:      { color: COLORS.subtle, fontSize: 13 },
  sliderValue:      { color: COLORS.teal2, fontWeight: '600', fontSize: 13 },
  sliderTrack:      { height: 4, backgroundColor: COLORS.border, borderRadius: 2 },
  sliderFill:       { height: 4, backgroundColor: COLORS.teal, borderRadius: 2 },
  sliderBtns:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  presetBtnActive:  { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  presetBtnText:    { color: COLORS.muted, fontSize: 11 },
  presetBtnTextActive: { color: '#fff', fontWeight: '600' },
  speakBtn:         { backgroundColor: COLORS.teal, borderRadius: RADIUS.xl, paddingVertical: 16, alignItems: 'center', marginBottom: 14, shadowColor: COLORS.teal, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  speakBtnStop:     { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', shadowOpacity: 0, elevation: 0 },
  speakBtnDisabled: { opacity: 0.5 },
  speakBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  waveWrap:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 4, height: 40, marginBottom: 14 },
  wavebar:          { width: 6, backgroundColor: COLORS.teal2, borderRadius: 3, opacity: 0.8 },
  sectionLabel:     { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 8 },
  phrasesCard:      { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  phrase:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  phraseDivider:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  phraseText:       { flex: 1, color: COLORS.text, fontSize: 13 },
})
