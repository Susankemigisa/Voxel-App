import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { Header } from '../components/Header'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'
import { synthesizeTTS } from '../lib/api'

const VOICES = [
  { id: 'female', label: 'Female', emoji: '👩' },
  { id: 'male',   label: 'Male',   emoji: '👨' },
  { id: 'robot',  label: 'Robot',  emoji: '🤖' },
]

const QUICK_PHRASES = [
  'Where is the exit?',
  'I need a wheelchair.',
  'Please call a doctor.',
  'I need help finding the bathroom.',
  'Can someone assist me please?',
  'Take me to Kampala CBD.',
]

export function TTSScreen() {
  const c = useColors()
  const styles = getStyles(c)
  const [text,     setText]     = useState('')
  const [voice,    setVoice]    = useState('female')
  const [language, setLanguage] = useState<'en'|'lg'>('en')
  const [pitch,    setPitch]    = useState(50)
  const [rate,     setRate]     = useState(60)
  const [loading,  setLoading]  = useState(false)
  const [playing,  setPlaying]  = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const charLimit = 300

  const handleSpeak = async () => {
    if (!text.trim()) { Alert.alert('Error', 'Enter some text first'); return }
    setLoading(true)
    try {
      const result = await synthesizeTTS({ text: text.trim(), language, voice: voice as any, pitch, rate })
      if (soundRef.current) {
        await soundRef.current.stopAsync()
        await soundRef.current.unloadAsync()
      }
      // Switch audio mode to playback (important on Android)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:         false,
        playsInSilentModeIOS:       true,
        shouldDuckAndroid:          false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground:    false,
      })
      const audioPath = `${FileSystem.cacheDirectory}voxel_tts_${Date.now()}.wav`
      await FileSystem.writeAsStringAsync(audioPath, result.audio_base64, {
        encoding: 'base64',
      })
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { shouldPlay: true, volume: 1.0 }
      )
      soundRef.current = sound
      setPlaying(true)
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false)
          sound.unloadAsync().catch(() => {})
          FileSystem.deleteAsync(audioPath, { idempotent: true }).catch(() => {})
        }
      })
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'TTS failed')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    await soundRef.current?.stopAsync()
    setPlaying(false)
  }

  return (
    <View style={styles.flex}>
      <Header title="Text to Speech" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Language toggle */}
        <View style={styles.row}>
          {(['en','lg'] as const).map(l => (
            <TouchableOpacity
              key={l}
              style={[styles.toggleBtn, language === l && styles.toggleBtnActive]}
              onPress={() => setLanguage(l)}
            >
              <Text style={[styles.toggleText, language === l && styles.toggleTextActive]}>
                {l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Text input */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            placeholder="Type something to speak…"
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={t => setText(t.slice(0, charLimit))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{text.length}/{charLimit}</Text>
        </View>

        {/* Voice selector */}
        <Text style={styles.sectionLabel}>Voice</Text>
        <View style={styles.row}>
          {VOICES.map(v => (
            <TouchableOpacity
              key={v.id}
              style={[styles.voiceBtn, voice === v.id && styles.voiceBtnActive]}
              onPress={() => setVoice(v.id)}
            >
              <Text style={styles.voiceEmoji}>{v.emoji}</Text>
              <Text style={[styles.voiceLabel, voice === v.id && styles.voiceLabelActive]}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sliders (simplified with buttons) */}
        <Text style={styles.sectionLabel}>Pitch: {pitch}%</Text>
        <View style={styles.sliderRow}>
          <TouchableOpacity style={styles.sliderBtn} onPress={() => setPitch(p => Math.max(0, p - 10))}>
            <Text style={styles.sliderBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${pitch}%` }]} />
          </View>
          <TouchableOpacity style={styles.sliderBtn} onPress={() => setPitch(p => Math.min(100, p + 10))}>
            <Text style={styles.sliderBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Speed: {rate}%</Text>
        <View style={styles.sliderRow}>
          <TouchableOpacity style={styles.sliderBtn} onPress={() => setRate(r => Math.max(20, r - 10))}>
            <Text style={styles.sliderBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${rate}%` }]} />
          </View>
          <TouchableOpacity style={styles.sliderBtn} onPress={() => setRate(r => Math.min(100, r + 10))}>
            <Text style={styles.sliderBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Speak button */}
        <TouchableOpacity
          style={[styles.speakBtn, (loading || !text.trim()) && styles.speakBtnDisabled]}
          onPress={playing ? handleStop : handleSpeak}
          disabled={loading || !text.trim()}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.speakBtnText}>{playing ? '⏹ Stop' : '▶ Speak'}</Text>
          }
        </TouchableOpacity>

        {/* Quick phrases */}
        <Text style={styles.sectionLabel}>Quick Phrases</Text>
        <View style={styles.phrasesWrap}>
          {QUICK_PHRASES.map(phrase => (
            <TouchableOpacity
              key={phrase}
              style={styles.phraseChip}
              onPress={() => setText(phrase)}
            >
              <Text style={styles.phraseText}>{phrase}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  )
}

const getStyles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  flex:    { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  row: {
    flexDirection:  'row',
    gap:            spacing.sm,
    marginVertical: spacing.sm,
  },
  toggleBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    radius.md,
    alignItems:      'center',
    backgroundColor: c.bgCard,
    borderWidth:     1,
    borderColor:     c.border,
  },
  toggleBtnActive: { backgroundColor: c.teal + '20', borderColor: c.teal },
  toggleText:      { fontSize: font.sm, color: c.textSub, fontWeight: '600' },
  toggleTextActive: { color: c.teal },

  inputCard: {
    backgroundColor: c.bgCard,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     c.border,
    padding:         spacing.md,
    marginVertical:  spacing.sm,
  },
  textInput: {
    fontSize:   font.md,
    color:      c.text,
    minHeight:  100,
    lineHeight: 24,
  },
  charCount: {
    fontSize:  font.xs,
    color:     c.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  sectionLabel: {
    fontSize:     font.sm,
    fontWeight:   '700',
    color:        c.textSub,
    marginTop:    spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  voiceBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    radius.md,
    backgroundColor: c.bgCard,
    borderWidth:     1,
    borderColor:     c.border,
    gap:             4,
  },
  voiceBtnActive: { backgroundColor: c.purple + '20', borderColor: c.purple },
  voiceEmoji:     { fontSize: 24 },
  voiceLabel:     { fontSize: font.xs, color: c.textSub, fontWeight: '600' },
  voiceLabelActive: { color: c.purple },

  sliderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    marginBottom:   spacing.sm,
  },
  sliderBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor: c.bgCard,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    c.border,
  },
  sliderBtnText: { fontSize: font.lg, color: c.text, fontWeight: '700' },
  sliderTrack: {
    flex:            1,
    height:          6,
    borderRadius:    3,
    backgroundColor: c.bgElevated,
    overflow:        'hidden',
  },
  sliderFill: {
    height:          6,
    backgroundColor: c.teal,
    borderRadius:    3,
  },

  speakBtn: {
    backgroundColor: c.teal,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginVertical:  spacing.md,
  },
  speakBtnDisabled: { opacity: 0.5 },
  speakBtnText: { fontSize: font.lg, fontWeight: '700', color: '#fff' },

  phrasesWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  phraseChip: {
    backgroundColor: c.bgCard,
    borderRadius:    radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs + 2,
    borderWidth:     1,
    borderColor:     c.border,
  },
  phraseText: { fontSize: font.sm, color: c.textSub },
})